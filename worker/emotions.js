// Endpoints émotions — liste, ajout, renommage, suppression

import { requireAuth } from './auth.js';

function uuid() {
  return crypto.randomUUID();
}

export async function handleEmotions(request, env, json, path) {
  const method = request.method;

  // Extrait l'ID depuis /api/emotions/:id
  const idMatch = path.match(/^\/api\/emotions\/([^/]+)$/);
  const id = idMatch ? idMatch[1] : null;

  // GET /api/emotions — liste complète des émotions disponibles
  if (path === '/api/emotions' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM emotions ORDER BY label ASC'
    ).all();
    return json({ emotions: results });
  }

  // POST /api/emotions — ajout d'une nouvelle émotion
  if (path === '/api/emotions' && method === 'POST') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const { label } = await request.json();
    if (!label?.trim()) return json({ error: 'Label requis' }, 400);

    const existing = await env.DB.prepare(
      'SELECT id FROM emotions WHERE label = ?'
    ).bind(label.trim()).first();

    if (existing) return json({ error: 'Cette émotion existe déjà' }, 409);

    const id = uuid();
    await env.DB.prepare(
      'INSERT INTO emotions (id, label) VALUES (?, ?)'
    ).bind(id, label.trim()).run();

    return json({ id, label: label.trim() }, 201);
  }

  // PATCH /api/emotions/:id — renommage d'une émotion
  if (id && method === 'PATCH') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const { label } = await request.json();
    if (!label?.trim()) return json({ error: 'Label requis' }, 400);

    const existing = await env.DB.prepare(
      'SELECT id FROM emotions WHERE id = ?'
    ).bind(id).first();

    if (!existing) return json({ error: 'Émotion introuvable' }, 404);

    // Récupérer l'ancien label pour mettre à jour les mèmes qui l'utilisent
    const emotion = await env.DB.prepare(
      'SELECT label FROM emotions WHERE id = ?'
    ).bind(id).first();

    const oldLabel = emotion.label;
    const newLabel = label.trim();

    await env.DB.prepare(
      'UPDATE emotions SET label = ? WHERE id = ?'
    ).bind(newLabel, id).run();

    // Mettre à jour le label dans tous les mèmes qui l'utilisent
    const { results: memes } = await env.DB.prepare(
      "SELECT id, emotions FROM memes WHERE emotions LIKE ?"
    ).bind(`%${oldLabel}%`).all();

    for (const meme of memes) {
      const emotions = JSON.parse(meme.emotions || '[]');
      const updated = emotions.map(e => (e === oldLabel ? newLabel : e));
      await env.DB.prepare(
        'UPDATE memes SET emotions = ? WHERE id = ?'
      ).bind(JSON.stringify(updated), meme.id).run();
    }

    return json({ success: true, id, label: newLabel });
  }

  // DELETE /api/emotions/:id — suppression d'une émotion et retrait des mèmes
  if (id && method === 'DELETE') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const emotion = await env.DB.prepare(
      'SELECT id, label FROM emotions WHERE id = ?'
    ).bind(id).first();

    if (!emotion) return json({ error: 'Émotion introuvable' }, 404);

    // Retirer l'émotion de tous les mèmes qui l'utilisent
    const { results: memes } = await env.DB.prepare(
      "SELECT id, emotions FROM memes WHERE emotions LIKE ?"
    ).bind(`%${emotion.label}%`).all();

    for (const meme of memes) {
      const emotions = JSON.parse(meme.emotions || '[]');
      const updated = emotions.filter(e => e !== emotion.label);
      await env.DB.prepare(
        'UPDATE memes SET emotions = ? WHERE id = ?'
      ).bind(JSON.stringify(updated), meme.id).run();
    }

    await env.DB.prepare('DELETE FROM emotions WHERE id = ?').bind(id).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}
