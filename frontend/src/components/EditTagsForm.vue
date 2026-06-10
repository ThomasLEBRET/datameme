<template>
  <div>
    <h2 class="title">Modifier les tags</h2>
    <p class="filename">{{ meme.filename }}</p>

    <div class="field">
      <label>Tags libres</label>
      <input
        v-model="tagInput"
        type="text"
        placeholder="Ajouter un tag et appuyer sur Entrée"
        @keyup.enter="addTag"
      />
      <div v-if="tags.length" class="tag-list">
        <span v-for="(t, i) in tags" :key="i" class="tag">
          {{ t }}
          <button @click="tags.splice(i, 1)" aria-label="Retirer">×</button>
        </span>
      </div>
    </div>

    <div class="field">
      <label>Émotions</label>
      <div class="emotion-list">
        <label v-for="em in emotions" :key="em.id" class="emotion-check">
          <input type="checkbox" :value="em.label" v-model="selectedEmotions" />
          {{ em.label }}
        </label>
        <span v-if="!emotions.length" class="no-em">Aucune émotion définie</span>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="btns">
      <button class="btn-cancel" @click="emit('close')">Annuler</button>
      <button class="btn-save" @click="save" :disabled="loading">
        {{ loading ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { updateMeme } from '../api.js'

const props = defineProps({ meme: Object, emotions: Array })
const emit = defineEmits(['saved', 'close'])

const tags = ref([...props.meme.tags])
const selectedEmotions = ref([...props.meme.emotions])
const tagInput = ref('')
const error = ref('')
const loading = ref(false)

function addTag() {
  const t = tagInput.value.trim()
  if (t && !tags.value.includes(t)) tags.value.push(t)
  tagInput.value = ''
}

async function save() {
  addTag()
  loading.value = true
  error.value = ''
  try {
    await updateMeme(props.meme.id, tags.value, selectedEmotions.value)
    emit('saved', { ...props.meme, tags: tags.value, emotions: selectedEmotions.value })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.title { font-size: 16px; font-weight: 500; margin-bottom: 4px; }
.filename { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; overflow: hidden; text-overflow: ellipsis; }

.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.field input[type=text] {
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

.tag-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  background: var(--purple-bg);
  color: var(--purple-light);
  border: 0.5px solid var(--purple-border);
}
.tag button { background: none; border: none; color: inherit; font-size: 14px; line-height: 1; padding: 0; cursor: pointer; opacity: 0.7; }

.emotion-list { display: flex; flex-wrap: wrap; gap: 8px; }
.emotion-check { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.emotion-check input { accent-color: var(--purple-light); }
.no-em { font-size: 12px; color: var(--text-muted); }

.error { font-size: 12px; color: var(--red-light); margin-bottom: 10px; }

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
