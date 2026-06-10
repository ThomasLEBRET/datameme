<template>
  <div>
    <h2 class="title">Changer le mot de passe</h2>

    <div class="field">
      <label>Mot de passe actuel</label>
      <input v-model="current" type="password" placeholder="••••••••" autocomplete="current-password" />
    </div>
    <div class="field">
      <label>Nouveau mot de passe</label>
      <input v-model="next" type="password" placeholder="••••••••" autocomplete="new-password" />
    </div>
    <div class="field">
      <label>Confirmer le nouveau mot de passe</label>
      <input v-model="confirm" type="password" placeholder="••••••••" autocomplete="new-password" @keyup.enter="submit" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">Mot de passe mis à jour.</p>

    <div class="btns">
      <button class="btn-cancel" @click="emit('close')">Annuler</button>
      <button class="btn-save" @click="submit" :disabled="loading">
        {{ loading ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { changePassword } from '../api.js'

const emit = defineEmits(['close'])

const current = ref('')
const next = ref('')
const confirm = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

async function submit() {
  error.value = ''
  success.value = false

  if (!current.value || !next.value || !confirm.value) {
    error.value = 'Tous les champs sont requis'
    return
  }
  if (next.value !== confirm.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  if (next.value.length < 8) {
    error.value = 'Le nouveau mot de passe doit faire au moins 8 caractères'
    return
  }

  loading.value = true
  try {
    await changePassword(current.value, next.value)
    success.value = true
    current.value = ''
    next.value = ''
    confirm.value = ''
    setTimeout(() => emit('close'), 1500)
  } catch (e) {
    error.value = e.message || 'Erreur lors du changement de mot de passe'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.title { font-size: 16px; font-weight: 500; margin-bottom: 16px; }

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
.success { font-size: 12px; color: var(--green-light); margin-bottom: 10px; }

.btns { display: flex; gap: 8px; margin-top: 4px; }
.btn-cancel {
  flex: 1;
  height: 36px;
  background: transparent;
  border: 0.5px solid var(--border-hover);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.btn-save {
  flex: 2;
  height: 36px;
  background: var(--purple);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #EEEDFE;
}
.btn-save:disabled { opacity: 0.5; }
</style>
