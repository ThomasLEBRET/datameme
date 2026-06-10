// Point d'entrée du Worker DataMeme
// Routage des requêtes vers les handlers appropriés

import { handleAuth } from './auth.js';
import { handleMemes } from './memes.js';
import { handleEmotions } from './emotions.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // En-têtes CORS pour le frontend Cloudflare Pages
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://datameme.cloud',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Réponse aux requêtes preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Fonction utilitaire pour construire une réponse JSON
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    try {
      // Routage par préfixe d'URL
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
