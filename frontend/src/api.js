// Client API — toutes les requêtes vers le Worker DataMeme

const BASE_URL = 'https://datameme-worker.th-lebret.workers.dev'

// Récupère le token JWT stocké en mémoire (module singleton)
let _token = null
export const auth = {
  setToken(t) { _token = t },
  getToken() { return _token },
  clear() { _token = null },
  isLogged() { return !!_token },
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur inconnue')
  return data
}

// Upload multipart (FormData) — pas de Content-Type manuel
async function upload(formData) {
  const headers = {}
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${BASE_URL}/api/memes`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur upload')
  return data
}

// Auth
export const login = (username, password) =>
  request('POST', '/api/auth/login', { username, password })

export const changePassword = (currentPassword, newPassword) =>
  request('POST', '/api/auth/password', { currentPassword, newPassword })

// Mèmes
export const getMemes = (page = 1, q = '') =>
  request('GET', `/api/memes?page=${page}&q=${encodeURIComponent(q)}`)

export const uploadMemes = (formData) => upload(formData)

export const updateMeme = (id, tags, emotions) =>
  request('PATCH', `/api/memes/${id}`, { tags, emotions })

export const deleteMeme = (id) =>
  request('DELETE', `/api/memes/${id}`)

// Émotions
export const getEmotions = () =>
  request('GET', '/api/emotions')

export const createEmotion = (label) =>
  request('POST', '/api/emotions', { label })

export const renameEmotion = (id, label) =>
  request('PATCH', `/api/emotions/${id}`, { label })

export const deleteEmotion = (id) =>
  request('DELETE', `/api/emotions/${id}`)
