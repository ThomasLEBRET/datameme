// Endpoints mèmes — liste, upload, mise à jour des tags, suppression

import { requireAuth } from './auth.js';
import { runOCR, runClassification } from './ai.js';

function uuid() {
  return crypto.randomUUID();
}

export async function handleMemes(request, env, json, path, ctx) {
  const method = request.method;

  // Extrait l'ID depuis /api/memes/:id
  const idMatch = path.match(/^\/api\/memes\/([^/]+)$/);
  const id = idMatch ? idMatch[1] : null;

  // POST /api/memes/dedup — suppression des doublons (nom + taille)
  if (path === '/api/memes/dedup' && method === 'POST') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    // Récupérer tous les mèmes
    const { results } = await env.DB.prepare(
      'SELECT id, filename, filesize FROM memes ORDER BY created_at ASC'
    ).all();

    const seen = new Map();
    const toDelete = [];

    for (const meme of results) {
      const key = `${meme.filename}__${meme.filesize}`;
      if (seen.has(key)) {
        toDelete.push(meme);
      } else {
        seen.set(key, meme.id);
      }
    }

    // Supprimer les doublons dans R2 et D1
    for (const meme of toDelete) {
      const ext = meme.filename?.split('.').pop()?.toLowerCase() || 'jpg';
      try { await env.R2.delete(`${meme.id}.${ext}`); } catch {}
      await env.DB.prepare('DELETE FROM memes WHERE id = ?').bind(meme.id).run();
    }

    return json({ deleted: toDelete.length });
  }

  // GET /api/memes — liste paginée avec recherche full-text
  if (path === '/api/memes' && method === 'GET') {
    const url = new URL(request.url);
    const search = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = 40;
    const offset = (page - 1) * limit;

    let query, params;

    if (search) {
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
      const arrayBuffer = await file.arrayBuffer();
      const filesize = arrayBuffer.byteLength;

      // Upload dans R2
      await env.R2.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      const url = `https://pub-a1770e0330114104863defe027dda98b.r2.dev/${key}`;

      // OCR via Workers AI
      const { text: ocrText, hasText } = await runOCR(env, arrayBuffer);

      let autoTags = [];
      if (hasText) {
        autoTags = ocrText
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 10);
      } else {
        autoTags = await runClassification(env, arrayBuffer);
      }

      const allTags = [...new Set([...commonTags, ...autoTags])];

      await env.DB.prepare(`
        INSERT INTO memes (id, url, filename, filesize, tags, emotions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        id, url, file.name, filesize,
        JSON.stringify(allTags),
        JSON.stringify(commonEmotions)
      ).run();

      uploaded.push({
        id, url, filename: file.name, filesize,
        tags: allTags,
        emotions: commonEmotions,
        ocrText: hasText ? ocrText : null,
      });
    }

    return json({ uploaded }, 201);
  }

  // DELETE /api/memes — suppression de TOUS les mèmes
  if (path === '/api/memes' && method === 'DELETE') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const { results } = await env.DB.prepare(
      'SELECT id, filename FROM memes'
    ).all();

    // Supprimer tous les objets R2
    for (const meme of results) {
      const ext = meme.filename?.split('.').pop()?.toLowerCase() || 'jpg';
      try { await env.R2.delete(`${meme.id}.${ext}`); } catch {}
    }

    // Vider la table
    await env.DB.prepare('DELETE FROM memes').run();

    return json({ deleted: results.length });
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

  // DELETE /api/memes/:id — suppression d'un mème
  if (id && method === 'DELETE') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const meme = await env.DB.prepare(
      'SELECT id, filename FROM memes WHERE id = ?'
    ).bind(id).first();

    if (!meme) return json({ error: 'Mème introuvable' }, 404);

    const ext = meme.filename?.split('.').pop()?.toLowerCase() || 'jpg';
    await env.R2.delete(`${meme.id}.${ext}`);
    await env.DB.prepare('DELETE FROM memes WHERE id = ?').bind(id).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}
