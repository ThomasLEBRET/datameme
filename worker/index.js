// Point d'entrée du Worker DataMeme

import { handleAuth } from './auth.js';
import { handleMemes } from './memes.js';
import { handleEmotions } from './emotions.js';
import { handleProxy } from './proxy.js';

// Origines autorisées à appeler l'API depuis un navigateur
const ALLOWED_ORIGINS = new Set([
  'https://datameme.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function resolveOrigin(origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  // Déploiements de prévisualisation Pages : https://<hash>.datameme.pages.dev
  if (origin && /^https:\/\/[\w-]+\.datameme\.pages\.dev$/.test(origin)) return origin;
  return 'https://datameme.pages.dev';
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': resolveOrigin(request.headers.get('Origin')),
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    try {
      if (path.startsWith('/api/auth')) return await handleAuth(request, env, json, path);
      if (path.startsWith('/api/memes')) return await handleMemes(request, env, json, path, ctx);
      if (path.startsWith('/api/emotions')) return await handleEmotions(request, env, json, path);
      if (path.startsWith('/api/proxy')) return await handleProxy(request, env, corsHeaders, path);
      return json({ error: 'Route introuvable' }, 404);
    } catch (err) {
      console.error('Erreur Worker :', err);
      return json({ error: 'Erreur serveur interne' }, 500);
    }
  },
};
