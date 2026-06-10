<template>
  <div>
    <h2 class="title">Espace admin</h2>
    <p class="subtitle">Connexion requise pour uploader ou supprimer des mèmes.</p>

    <div class="field">
      <label>Identifiant</label>
      <input v-model="username" type="text" placeholder="admin" autocomplete="username" @keyup.enter="submit" />
    </div>
    <div class="field">
      <label>Mot de passe</label>
      <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" @keyup.enter="submit" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button class="btn-primary" @click="submit" :disabled="loading">
      {{ loading ? 'Connexion…' : 'Se connecter' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { login, auth } from '../api.js'

const emit = defineEmits(['success'])
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value || !password.value) {
    error.value = 'Identifiant et mot de passe requis'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await login(username.value, password.value)
    auth.setToken(data.token)
    emit('success')
  } catch (e) {
    error.value = e.message || 'Identifiants incorrects'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.title { font-size: 16px; font-weight: 500; margin-bottom: 6px; }
.subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }

.field { margin-bottom: 12px; }
.field label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 5px; }
.field input {
  width: 100%;
  height: 36px;
  background: var(--bg-base);
  border: 0.5px solid var(--border-hover);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}
.field input:focus { border-color: var(--purple-light); }

.error { font-size: 12px; color: var(--red-light); margin-bottom: 10px; }

.btn-primary {
  width: 100%;
  height: 36px;
  background: var(--purple);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #EEEDFE;
  margin-top: 4px;
  transition: background 0.15s;
}
.btn-primary:hover { background: #5e54cc; }
.btn-primary:disabled { opacity: 0.6; }
</style>
