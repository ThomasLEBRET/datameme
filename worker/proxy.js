// Proxy d'images R2 — permet le fetch depuis le frontend sans blocage CORS

export async function handleProxy(request, env, corsHeaders, path) {
  // GET /api/proxy/:key — retourne l'image depuis R2 avec headers CORS
  const keyMatch = path.match(/^\/api\/proxy\/(.+)$/);
  if (!keyMatch || request.method !== 'GET') {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const key = keyMatch[1];

  // Seules les clés générées par l'upload sont servies : <uuid>.<extension image>
  if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(key)) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  const object = await env.R2.get(key);
  if (!object) {
    return new Response('Image introuvable', { status: 404, headers: corsHeaders });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
      ...corsHeaders,
    },
  });
}
