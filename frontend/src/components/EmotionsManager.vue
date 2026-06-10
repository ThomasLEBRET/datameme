<template>
  <div>
    <h2 class="title">Gestion des émotions</h2>

    <!-- Ajouter une émotion -->
    <div class="add-row">
      <input v-model="newLabel" type="text" placeholder="Nouvelle émotion…" @keyup.enter="add" />
      <button class="btn-add" @click="add" :disabled="!newLabel.trim()">Ajouter</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <!-- Liste -->
    <div class="list">
      <div v-for="em in emotions" :key="em.id" class="item">
        <template v-if="editingId === em.id">
          <input v-model="editLabel" class="edit-input" @keyup.enter="saveEdit(em.id)" @keyup.escape="editingId = null" />
          <button class="btn-sm save" @click="saveEdit(em.id)">OK</button>
          <button class="btn-sm" @click="editingId = null">Annuler</button>
        </template>
        <template v-else>
          <span class="label">{{ em.label }}</span>
          <div class="actions">
            <button class="btn-sm" @click="startEdit(em)">Renommer</button>
            <button class="btn-sm danger" @click="remove(em.id)">Supprimer</button>
          </div>
        </template>
      </div>
      <div v-if="!emotions.length" class="empty">Aucune émotion définie.</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createEmotion, renameEmotion, deleteEmotion } from '../api.js'

const props = defineProps({ emotions: Array })
const emit = defineEmits(['updated'])

const newLabel = ref('')
const editingId = ref(null)
const editLabel = ref('')
const error = ref('')

async function add() {
  if (!newLabel.value.trim()) return
  error.value = ''
  try {
    await createEmotion(newLabel.value.trim())
    newLabel.value = ''
    emit('updated')
  } catch (e) {
    error.value = e.message
  }
}

function startEdit(em) {
  editingId.value = em.id
  editLabel.value = em.label
}

async function saveEdit(id) {
  if (!editLabel.value.trim()) return
  try {
    await renameEmotion(id, editLabel.value.trim())
    editingId.value = null
    emit('updated')
  } catch (e) {
    error.value = e.message
  }
}

async function remove(id) {
  if (!confirm('Supprimer cette émotion ? Elle sera retirée de tous les mèmes.')) return
  try {
    await deleteEmotion(id)
    emit('updated')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<style scoped>
.title { font-size: 16px; font-weight: 500; margin-bottom: 16px; }

.add-row { display: flex; gap: 8px; margin-bottom: 10px; }
.add-row input {
  flex: 1;
  height: 34px;
  background: var(--bg-base);
  border: 0.5px solid var(--border-hover);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
}
.add-row input:focus { border-color: var(--purple-light); }
.btn-add {
  height: 34px;
  padding: 0 14px;
  background: var(--purple);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #EEEDFE;
}
.btn-add:disabled { opacity: 0.5; }

.error { font-size: 12px; color: var(--red-light); margin-bottom: 10px; }

.list { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.label { color: var(--text-secondary); }
.actions { display: flex; gap: 6px; }
.edit-input {
  flex: 1;
  height: 28px;
  background: var(--bg-base);
  border: 0.5px solid var(--purple-light);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}
.btn-sm {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 0.5px solid var(--border-hover);
  background: transparent;
  color: var(--text-secondary);
  transition: background 0.15s;
}
.btn-sm:hover { background: rgba(255,255,255,0.06); }
.btn-sm.save { border-color: var(--purple-border); color: var(--purple-light); }
.btn-sm.danger { color: var(--red-light); border-color: rgba(224,75,74,0.3); }
.btn-sm.danger:hover { background: var(--red-bg); }

.empty { font-size: 13px; color: var(--text-muted); padding: 8px 0; }
</style>
