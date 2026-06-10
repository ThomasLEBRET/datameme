// Point d'entrée du Worker DataMeme
// Routage des requêtes vers les handlers appropriés

import { handleAuth } from './auth.js';
import { handleMemes } from './memes.js';
import { handleEmotions } from './emotions.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      if (path.startsWith('/api/auth')) {
        return await handleAuth(request, env, json, path);
      }
      if (path.startsWith('/api/memes')) {
        return await handleMemes(request, env, json, path, ctx);
      }
      if (path.startsWith('/api/emotions')) {
        return await handleEmotions(request, env, json, path);
      }
      return json({ error: 'Route introuvable' }, 404);
    } catch (err) {
      console.error('Erreur Worker :', err);
      return json({ error: 'Erreur serveur interne' }, 500);
    }
  },
};
