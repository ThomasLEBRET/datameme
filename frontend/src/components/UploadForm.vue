<template>
  <div>
    <h2 class="title">Uploader des mèmes</h2>

    <!-- Zone de drop -->
    <div
      class="drop-zone"
      :class="{ dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @click="fileInput.click()"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="color:var(--purple-light); margin-bottom:8px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span>Glisse des images ici ou clique pour sélectionner</span>
      <input ref="fileInput" type="file" multiple accept="image/*" style="display:none" @change="onFileChange" />
    </div>

    <!-- Aperçu fichiers sélectionnés -->
    <div v-if="files.length" class="file-list">
      <div v-for="(f, i) in files" :key="i" class="file-item">
        <span class="file-name">{{ f.name }}</span>
        <button class="file-remove" @click="files.splice(i, 1)" aria-label="Retirer">×</button>
      </div>
    </div>

    <!-- Tags communs -->
    <div class="field">
      <label>Tags communs au lot</label>
      <input
        v-model="tagInput"
        type="text"
        placeholder="ex: travail, réunion, chaos (séparés par des virgules)"
        @keyup.enter="addTags"
        @blur="addTags"
      />
      <div v-if="tags.length" class="tag-list">
        <span v-for="(t, i) in tags" :key="i" class="tag">
          {{ t }}
          <button @click="tags.splice(i, 1)" aria-label="Retirer">×</button>
        </span>
      </div>
    </div>

    <!-- Émotions communes -->
    <div class="field">
      <label>Émotions communes au lot</label>
      <div class="emotion-list">
        <label v-for="em in emotions" :key="em.id" class="emotion-check">
          <input type="checkbox" :value="em.label" v-model="selectedEmotions" />
          {{ em.label }}
        </label>
        <span v-if="!emotions.length" class="no-emotions">Aucune émotion définie</span>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p class="hint">L'OCR et la classification s'appliquent automatiquement à chaque image.</p>

    <button class="btn-primary" @click="submit" :disabled="loading || !files.length">
      {{ loading ? `Traitement… (${doneCount}/${files.length})` : `Uploader ${files.length || ''} image(s)` }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { uploadMemes } from '../api.js'

const props = defineProps({ emotions: Array })
const emit = defineEmits(['uploaded', 'close'])

const fileInput = ref(null)
const files = ref([])
const tagInput = ref('')
const tags = ref([])
const selectedEmotions = ref([])
const error = ref('')
const loading = ref(false)
const dragging = ref(false)
const doneCount = ref(0)

function onFileChange(e) {
  files.value = [...files.value, ...Array.from(e.target.files)]
  e.target.value = ''
}

function onDrop(e) {
  dragging.value = false
  const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  files.value = [...files.value, ...dropped]
}

function addTags() {
  const newTags = tagInput.value.split(',').map(t => t.trim()).filter(t => t && !tags.value.includes(t))
  tags.value = [...tags.value, ...newTags]
  tagInput.value = ''
}

// Redimensionne une image à max 1920px côté client avant upload (skip GIF)
function resizeImageFile(file, maxDim = 1920) {
  if (file.type === 'image/gif') return Promise.resolve(file)
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const { naturalWidth: w, naturalHeight: h } = img
      if (w <= maxDim && h <= maxDim) { resolve(file); return }
      const ratio = Math.min(maxDim / w, maxDim / h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: file.type, lastModified: file.lastModified }))
      }, file.type, 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

async function submit() {
  if (!files.value.length) return
  addTags()
  loading.value = true
  error.value = ''
  doneCount.value = 0

  try {
    const resized = await Promise.all(files.value.map(f => resizeImageFile(f)))
    const formData = new FormData()
    for (const f of resized) formData.append('images', f)
    formData.append('tags', JSON.stringify(tags.value))
    formData.append('emotions', JSON.stringify(selectedEmotions.value))

    const data = await uploadMemes(formData)
    emit('uploaded', data.uploaded)
  } catch (e) {
    error.value = e.message || 'Erreur lors de l\'upload'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.title { font-size: 16px; font-weight: 500; margin-bottom: 16px; }

.drop-zone {
  border: 1px dashed var(--purple-border);
  border-radius: 10px;
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: border-color 0.15s, background 0.15s;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: var(--purple-light);
  background: var(--purple-bg);
}

.file-list { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 6px;
  padding: 4px 10px;
}
.file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-remove { background: none; border: none; color: var(--text-muted); font-size: 16px; line-height: 1; padding: 0 0 0 8px; }

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
.emotion-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.emotion-check input { accent-color: var(--purple-light); }
.no-emotions { font-size: 12px; color: var(--text-muted); }

.error { font-size: 12px; color: var(--red-light); margin-bottom: 8px; }
.hint { font-size: 11px; color: var(--text-muted); margin-bottom: 12px; }

.btn-primary {
  width: 100%;
  height: 36px;
  background: var(--purple);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #EEEDFE;
  transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #5e54cc; }
.btn-primary:disabled { opacity: 0.5; }
</style>
