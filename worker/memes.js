// Endpoints mèmes — liste, upload, mise à jour des tags, suppression

import { requireAuth } from './auth.js';
import { runOCR, runClassification } from './ai.js';

// Génère un UUID v4
function uuid() {
  return crypto.randomUUID();
}

export async function handleMemes(request, env, json, path, ctx) {
  const method = request.method;

  // Extrait l'ID depuis /api/memes/:id
  const idMatch = path.match(/^\/api\/memes\/([^/]+)$/);
  const id = idMatch ? idMatch[1] : null;

  // GET /api/memes — liste paginée avec recherche full-text optionnelle
  if (path === '/api/memes' && method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = 20;
    const offset = (page - 1) * limit;

    let query, params;

    if (search) {
      // Recherche dans les tags et les émotions (LIKE sur les champs JSON texte)
      const term = `%${search}%`;
      query = `
        SELECT * FROM memes
        WHERE tags LIKE ? OR emotions LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [term, term, limit, offset];
    } else {
      query = `
        SELECT * FROM memes
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }

    const { results } = await env.DB.prepare(query).bind(...params).all();

    // Désérialiser les champs JSON
    const memes = results.map(m => ({
      ...m,
      tags: JSON.parse(m.tags || '[]'),
      emotions: JSON.parse(m.emotions || '[]'),
    }));

    return json({ memes, page, limit });
  }

  // POST /api/memes — upload d'un ou plusieurs mèmes
  if (path === '/api/memes' && method === 'POST') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const formData = await request.formData();
    const files = formData.getAll('images');
    const commonTags = JSON.parse(formData.get('tags') || '[]');
    const commonEmotions = JSON.parse(formData.get('emotions') || '[]');

    if (!files.length) {
      return json({ error: 'Aucune image fournie' }, 400);
    }

    const uploaded = [];

    for (const file of files) {
      const id = uuid();
      const ext = file.name.split('.').pop().toLowerCase();
      const key = `${id}.${ext}`;

      // Upload dans R2
      await env.R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      const url = `https://pub-a1770e0330114104863defe027dda98b.r2.dev/${key}`;

      // OCR via Workers AI
      const arrayBuffer = await file.arrayBuffer();
      const { text: ocrText, hasText } = await runOCR(env, arrayBuffer);

      let autoTags = [];

      if (hasText) {
        // Découper le texte OCR en mots significatifs (> 3 caractères)
        autoTags = ocrText
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 10);
      } else {
        // Pas de texte détecté → classification visuelle
        autoTags = await runClassification(env, arrayBuffer);
      }

      // Fusion tags communs + tags automatiques (dédupliqués)
      const allTags = [...new Set([...commonTags, ...autoTags])];

      // Insertion en D1
      await env.DB.prepare(`
        INSERT INTO memes (id, url, filename, tags, emotions, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        id,
        url,
        file.name,
        JSON.stringify(allTags),
        JSON.stringify(commonEmotions)
      ).run();

      uploaded.push({
        id,
        url,
        filename: file.name,
        tags: allTags,
        emotions: commonEmotions,
        ocrText: hasText ? ocrText : null,
      });
    }

    return json({ uploaded }, 201);
  }

  // PATCH /api/memes/:id — mise à jour des tags et émotions
  if (id && method === 'PATCH') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const { tags, emotions } = await request.json();

    const existing = await env.DB.prepare(
      'SELECT id FROM memes WHERE id = ?'
    ).bind(id).first();

    if (!existing) return json({ error: 'Mème introuvable' }, 404);

    await env.DB.prepare(`
      UPDATE memes SET tags = ?, emotions = ? WHERE id = ?
    `).bind(
      JSON.stringify(tags ?? []),
      JSON.stringify(emotions ?? []),
      id
    ).run();

    return json({ success: true });
  }

  // DELETE /api/memes/:id — suppression dans R2 et D1
  if (id && method === 'DELETE') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const meme = await env.DB.prepare(
      'SELECT id, url, filename FROM memes WHERE id = ?'
    ).bind(id).first();

    if (!meme) return json({ error: 'Mème introuvable' }, 404);

    // Supprimer le fichier dans R2
    const ext = meme.filename?.split('.').pop()?.toLowerCase() || 'jpg';
    await env.R2.delete(`${meme.id}.${ext}`);

    // Supprimer la ligne dans D1
    await env.DB.prepare('DELETE FROM memes WHERE id = ?').bind(id).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}