// Authentification admin — JWT signé HMAC-SHA256, mots de passe PBKDF2 salés

const TOKEN_TTL = 7 * 24 * 3600;
const PBKDF2_ITERATIONS = 10000;

// Rate limiting login : 5 tentatives / 10 min par IP, stocké en D1
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 600; // secondes

async function checkRateLimit(env, ip) {
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'SELECT attempts, reset_at FROM login_attempts WHERE key = ?'
  ).bind(key).first();

  if (row && now < row.reset_at) {
    if (row.attempts >= RATE_LIMIT_MAX) return false;
    await env.DB.prepare(
      'UPDATE login_attempts SET attempts = attempts + 1 WHERE key = ?'
    ).bind(key).run();
  } else {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO login_attempts (key, attempts, reset_at) VALUES (?, 1, ?)'
    ).bind(key, now + RATE_LIMIT_WINDOW).run();
  }
  return true;
}

async function resetRateLimit(env, ip) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?')
    .bind(`rl:${ip}`).run();
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Génère un JWT signé avec HMAC-SHA256
async function signJWT(payload, secret) {
  if (!secret) throw new Error('JWT_SECRET non configuré');
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

// Vérifie et décode un JWT — retourne null pour tout token invalide ou malformé
async function verifyJWT(token, secret) {
  if (!secret) return null;
  try {
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
  } catch {
    return null;
  }
}

// Extrait et vérifie le JWT depuis l'en-tête Authorization
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  return await verifyJWT(token, env.JWT_SECRET);
}

async function pbkdf2Hash(password, saltHex, iterations) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g), h => parseInt(h, 16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return toHex(bits);
}

// Format stocké : pbkdf2$<itérations>$<sel hex>$<dérivé hex>
async function hashPassword(password) {
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const dk = await pbkdf2Hash(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${dk}`;
}

// Ancien format : SHA-256 non salé — conservé uniquement pour la migration transparente
async function legacyHash(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return toHex(buf);
}

async function verifyPassword(password, stored) {
  if (stored.startsWith('pbkdf2$')) {
    const [, iterations, salt, dk] = stored.split('$');
    return (await pbkdf2Hash(password, salt, parseInt(iterations, 10))) === dk;
  }
  return (await legacyHash(password)) === stored;
}

export async function handleAuth(request, env, json, path) {
  const method = request.method;

  // POST /api/auth/login — connexion admin
  if (path === '/api/auth/login' && method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await checkRateLimit(env, ip))) {
      return json({ error: 'Trop de tentatives, réessaie dans 10 minutes' }, 429);
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ error: 'Identifiant et mot de passe requis' }, 400);
    }

    const admin = await env.DB.prepare(
      'SELECT * FROM admin WHERE username = ?'
    ).bind(username).first();

    // Le hash est calculé même si l'utilisateur n'existe pas (anti-énumération par timing)
    const valid = await verifyPassword(password, admin?.password_hash || 'deadbeef'.repeat(8));

    if (!admin || !valid) {
      // Délai sur échec : freine le brute force sans consommer de CPU
      await new Promise(r => setTimeout(r, 400));
      return json({ error: 'Identifiants incorrects' }, 401);
    }

    await resetRateLimit(env, ip);

    // Migration transparente de l'ancien hash SHA-256 vers PBKDF2 au premier login réussi
    if (!admin.password_hash.startsWith('pbkdf2$')) {
      await env.DB.prepare('UPDATE admin SET password_hash = ? WHERE id = ?')
        .bind(await hashPassword(password), admin.id).run();
    }

    const token = await signJWT(
      { sub: admin.id, username: admin.username, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL },
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

    if (!admin || !(await verifyPassword(currentPassword, admin.password_hash))) {
      return json({ error: 'Mot de passe actuel incorrect' }, 401);
    }

    await env.DB.prepare(
      'UPDATE admin SET password_hash = ? WHERE id = ?'
    ).bind(await hashPassword(newPassword), auth.sub).run();

    return json({ success: true });
  }

  return json({ error: 'Route introuvable' }, 404);
}
