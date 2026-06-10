// Authentification admin — JWT signé, stocké en mémoire côté client uniquement

// Génère un JWT signé avec HMAC-SHA256
async function signJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${sig}`;
}

// Vérifie et décode un JWT
async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
  if (!valid) return null;

  const payload = JSON.parse(atob(body));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;

  return payload;
}

// Extrait et vérifie le JWT depuis l'en-tête Authorization
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  return await verifyJWT(token, env.JWT_SECRET);
}

// Hash d'un mot de passe via SHA-256 (bcrypt non disponible dans Workers)
// Note : bcrypt est stocké dans D1 mais le hash comparé ici est SHA-256
async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handleAuth(request, env, json, path) {
  const method = request.method;

  // POST /api/auth/login — connexion admin
  if (path === '/api/auth/login' && method === 'POST') {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Identifiant et mot de passe requis' }, 400);
    }

    const admin = await env.DB.prepare(
      'SELECT * FROM admin WHERE username = ?'
    ).bind(username).first();

    if (!admin) {
      return json({ error: 'Identifiants incorrects' }, 401);
    }

    const hash = await hashPassword(password);
    if (hash !== admin.password_hash) {
      return json({ error: 'Identifiants incorrects' }, 401);
    }

    // JWT valide 8 heures
    const token = await signJWT(
      { sub: admin.id, username: admin.username, exp: Math.floor(Date.now() / 1000) + 28800 },
      env.JWT_SECRET
    );

    return json({ token });
  }

  // POST /api/auth/password — changement de mot de passe
  if (path === '/api/auth/password' && method === 'POST') {
    const auth = await requireAuth(request, env);
    if (!auth) return json({ error: 'Non autorisé' }, 401);

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return json({ error: 'Ancien et nouveau mot de passe requis' }, 400);
    }
    if (newPassword.length < 8) {
      return json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' }, 400);
    }

    const admin = await env.DB.prepare(
      'SELECT * FROM admin WHERE id = ?'
    ).bind(auth.sub).first();

    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== admin.password_hash) {
      return json({ error: 'Mot de passe actuel incorrect' }, 401);
    }

    const newHash = await hashPassword(newPassword);
    await env.DB.prepare(
      'UPDATE admin SET password_hash = ? WHERE id = ?'
    ).bind(newHash, auth.sub).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}
