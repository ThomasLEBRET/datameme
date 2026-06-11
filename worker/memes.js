// Endpoints mèmes — liste, upload, mise à jour des tags, suppression

import { requireAuth } from './auth.js';
import { runOCR, runDescription } from './ai.js';

function uuid() {
  return crypto.randomUUID();
}

// Types d'images acceptés à l'upload — l'extension stockée est dérivée du MIME, jamais du nom de fichier
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const MAX_FILES_PER_UPLOAD = 20;

// Mots vides FR/EN exclus des tags générés depuis le texte OCR
const STOPWORDS = new Set([
  // français
  'une', 'des', 'les', 'dans', 'pour', 'avec', 'sans', 'sur', 'sous', 'est', 'sont',
  'être', 'avoir', 'fait', 'faire', 'faut', 'plus', 'moins', 'très', 'bien', 'mais',
  'donc', 'alors', 'quand', 'comme', 'comment', 'pourquoi', 'parce', 'que', 'qui',
  'quoi', 'cette', 'ceux', 'celle', 'tout', 'tous', 'toute', 'toutes', 'votre',
  'notre', 'leur', 'leurs', 'vous', 'nous', 'elle', 'elles', 'ils', 'mon', 'ton',
  'son', 'mes', 'tes', 'ses', 'aux', 'par', 'pas', 'peu', 'peut', 'cela', 'ceci',
  'ici', 'avez', 'avons', 'ont', 'encore', 'jamais', 'toujours', 'rien', 'chose',
  'quel', 'quelle', 'entre', 'avant', 'depuis', 'aussi', 'autre', 'chaque', 'même',
  // anglais
  'the', 'and', 'this', 'that', 'with', 'from', 'your', 'you', 'have', 'has',
  'what', 'when', 'where', 'will', 'would', 'there', 'their', 'they', 'then',
  'than', 'been', 'were', 'are', 'was', 'not', 'but', 'for', 'all', 'can',
  'just', 'like', 'get', 'got', 'one', 'out', 'now', 'how', 'why', 'who',
  'his', 'her', 'him', 'she', 'its', 'our',
  // bruit fréquent des réponses du modèle vision
  'image', 'text', 'meme', 'says', 'reads', 'written', 'caption', 'photo',
  'picture', 'top', 'bottom',
]);

// Extrait des tags exploitables depuis le texte OCR : mots significatifs, dédupliqués
function tagsFromText(text) {
  const words = text
    .toLowerCase()
    .split(/[^a-zà-ÿœç0-9']+/i)
    .map(w => w.replace(/^'+|'+$/g, ''))
    .filter(w => w.length >= 3 && w.length <= 24 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].slice(0, 8);
}

async function purgeCache(key) {
  try {
    const url = `${WORKER_BASE}/api/proxy/${key}`;
    await caches.default.delete(new Request(url));
  } catch {}
}

// Clé R2 d'un mème — depuis l'URL stockée (toujours fidèle), sinon reconstruite depuis le filename
function r2KeyOf(meme) {
  const fromUrl = meme.url?.split('/').pop();
  if (fromUrl) return fromUrl;
  const ext = meme.filename?.split('.').pop()?.toLowerCase() || 'jpg';
  return `${meme.id}.${ext}`;
}

const WORKER_BASE = 'https://datameme-worker.th-lebret.workers.dev';
const R2_PUBLIC_RE = /^https:\/\/pub-[a-f0-9]+\.r2\.dev\//;

// Remplace l'URL r2.dev par le proxy worker — les images passent par le cache Cloudflare
function proxyUrl(url) {
  if (!url) return url;
  const key = url.split('/').pop();
  if (R2_PUBLIC_RE.test(url)) return `${WORKER_BASE}/api/proxy/${key}`;
  return url;
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
      'SELECT id, filename, filesize, url FROM memes ORDER BY created_at ASC'
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
      try { await env.R2.delete(r2KeyOf(meme)); } catch {}
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
        WHERE tags LIKE ? OR emotions LIKE ? OR description LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [term, term, term, limit, offset];
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
      url: proxyUrl(m.url),
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

    let commonTags, commonEmotions;
    try {
      commonTags = JSON.parse(formData.get('tags') || '[]');
      commonEmotions = JSON.parse(formData.get('emotions') || '[]');
    } catch {
      return json({ error: 'Champs tags/emotions invalides' }, 400);
    }
    if (!Array.isArray(commonTags) || !Array.isArray(commonEmotions)) {
      return json({ error: 'Champs tags/emotions invalides' }, 400);
    }
    commonTags = commonTags
      .filter(t => typeof t === 'string' && t.trim())
      .map(t => t.trim().slice(0, 50))
      .slice(0, 30);
    commonEmotions = commonEmotions
      .filter(e => typeof e === 'string' && e.trim())
      .map(e => e.trim().slice(0, 50))
      .slice(0, 30);

    if (!files.length) {
      return json({ error: 'Aucune image fournie' }, 400);
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return json({ error: `Maximum ${MAX_FILES_PER_UPLOAD} images par envoi` }, 400);
    }

    // Validation de tout le lot avant le moindre upload
    for (const file of files) {
      if (!ALLOWED_TYPES[file.type]) {
        return json({ error: `Type non supporté : ${file.name}` }, 415);
      }
      if (file.size > MAX_FILE_SIZE) {
        return json({ error: `Fichier trop lourd (max 10 Mo) : ${file.name}` }, 413);
      }
    }

    const uploaded = [];

    for (const file of files) {
      const id = uuid();
      const ext = ALLOWED_TYPES[file.type];
      const key = `${id}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const filesize = arrayBuffer.byteLength;

      // Upload dans R2
      await env.R2.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      const url = `https://pub-a1770e0330114104863defe027dda98b.r2.dev/${key}`;

      // Tags automatiques : texte OCR → mots-clés vision → classification (dernier recours)
      const [{ text: ocrText, hasText }, description] = await Promise.all([
        runOCR(env, arrayBuffer),
        runDescription(env, arrayBuffer),
      ]);

      const autoTags = hasText ? tagsFromText(ocrText) : [];
      const allTags = [...new Set([...commonTags, ...autoTags])];

      await env.DB.prepare(`
        INSERT INTO memes (id, url, filename, filesize, tags, emotions, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        id, url, file.name, filesize,
        JSON.stringify(allTags),
        JSON.stringify(commonEmotions),
        description
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
      'SELECT id, filename, url FROM memes'
    ).all();

    for (const meme of results) {
      const key = r2KeyOf(meme);
      try { await env.R2.delete(key); } catch {}
      await purgeCache(key);
    }

    await env.DB.prepare('DELETE FROM memes').run();

    return json({ deleted: results.length });
  }

  // POST /api/memes/redescribe — génère les descriptions manquantes sur les mèmes existants
  // Endpoint one-shot à appeler depuis l'interface admin après la migration 004
  if (path === '/api/memes/redescribe' && method === 'POST') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    // Récupère uniquement les mèmes sans description (migration idempotente)
    const { results } = await env.DB.prepare(
      "SELECT id, url FROM memes WHERE description IS NULL OR description = '' ORDER BY created_at ASC"
    ).all();

    if (!results.length) return json({ processed: 0, message: 'Tous les mèmes ont déjà une description' });

    let processed = 0;
    let errors = 0;

    for (const meme of results) {
      try {
        // Récupère l'image depuis R2 via la clé extraite de l'URL
        const key = meme.url.split('/').pop();
        const object = await env.R2.get(key);
        if (!object) { errors++; continue; }

        const arrayBuffer = await object.arrayBuffer();
        const description = await runDescription(env, arrayBuffer);

        if (description) {
          await env.DB.prepare(
            'UPDATE memes SET description = ? WHERE id = ?'
          ).bind(description, meme.id).run();
          processed++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Erreur redescribe mème ${meme.id} :`, err);
        errors++;
      }
    }

    return json({ processed, errors, total: results.length });
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
      'SELECT id, filename, url FROM memes WHERE id = ?'
    ).bind(id).first();

    if (!meme) return json({ error: 'Mème introuvable' }, 404);

    const key = r2KeyOf(meme);
    await env.R2.delete(key);
    await purgeCache(key);
    await env.DB.prepare('DELETE FROM memes WHERE id = ?').bind(id).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}