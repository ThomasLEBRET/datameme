// Client API — toutes les requêtes vers le Worker DataMeme

import { ref } from 'vue'

const BASE_URL = 'https://datameme-worker.th-lebret.workers.dev'
const TOKEN_KEY = 'datameme_token'

// Relit le token persisté et vérifie son expiration (champ exp du JWT)
function readStoredToken() {
  const t = localStorage.getItem(TOKEN_KEY)
  if (!t) return null
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return t
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

// Ref Vue : l'état de connexion est réactif dans les templates
const _token = ref(readStoredToken())

export const auth = {
  setToken(t) {
    _token.value = t
    localStorage.setItem(TOKEN_KEY, t)
  },
  getToken() { return _token.value },
  clear() {
    _token.value = null
    localStorage.removeItem(TOKEN_KEY)
  },
  isLogged() { return !!_token.value },
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token.value) headers['Authorization'] = `Bearer ${_token.value}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    // Token expiré ou invalide → déconnexion (sauf routes auth où 401 = mauvais mot de passe)
    if (res.status === 401 && _token.value && !path.startsWith('/api/auth')) auth.clear()
    throw new Error(data.error || 'Erreur inconnue')
  }
  return data
}

async function upload(formData) {
  const headers = {}
  if (_token.value) headers['Authorization'] = `Bearer ${_token.value}`
  const res = await fetch(`${BASE_URL}/api/memes`, {
    method: 'POST',
    headers,
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 401 && _token.value) auth.clear()
    throw new Error(data.error || 'Erreur upload')
  }
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
export const deleteAll = () =>
  request('DELETE', '/api/memes')
export const deduplicateMemes = () =>
  request('POST', '/api/memes/dedup')

// Émotions
export const getEmotions = () => request('GET', '/api/emotions')
export const createEmotion = (label) => request('POST', '/api/emotions', { label })
export const renameEmotion = (id, label) => request('PATCH', `/api/emotions/${id}`, { label })
export const deleteEmotion = (id) => request('DELETE', `/api/emotions/${id}`)
