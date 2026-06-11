<template>
  <div
    class="card"
    @contextmenu.prevent="onRightClick"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
    @touchmove="cancelLongPress"
  >
    <!-- Tags -->
    <div class="tags" v-if="meme.tags.length || meme.emotions.length">
      <span v-for="tag in meme.tags" :key="tag" class="tag">{{ tag }}</span>
      <span v-for="em in meme.emotions" :key="em" class="tag emotion">{{ em }}</span>
    </div>

    <!-- Image — clic = lightbox -->
    <div class="img-wrap" @click="emit('lightbox', meme)">
      <img
        :src="meme.url"
        :alt="meme.filename"
        loading="lazy"
        @error="onImgError"
      />
      <div class="img-overlay" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span class="date">{{ formatDate(meme.created_at) }}</span>
      <button
        class="copy-btn"
        :class="{ success: copyState === 'ok' || copyState === 'downloaded', fail: copyState === 'fail' }"
        @click.stop="copyMeme"
        :disabled="copyState !== 'idle'"
        :aria-label="copyLabel"
      >
        <!-- Icône selon l'état -->
        <svg v-if="copyState === 'idle'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg v-else-if="copyState === 'ok'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        {{ copyLabel }}
      </button>
    </div>

    <!-- Menu contextuel admin -->
    <div
      v-if="isAdmin && ctxVisible"
      class="ctx-menu"
      :style="{ top: ctxY + 'px', left: ctxX + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="onEditClick">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Modifier les tags
      </button>
      <button class="ctx-item danger" @click="onDeleteClick">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        Supprimer
      </button>
    </div>
  </div>

  <teleport to="body">
    <div v-if="ctxVisible" class="ctx-overlay" @click="ctxVisible = false" @contextmenu.prevent="ctxVisible = false"></div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { copyImageToClipboard } from '../copyImage.js'

const props = defineProps({
  meme: Object,
  isAdmin: Boolean,
})
const emit = defineEmits(['delete', 'edit', 'copied', 'lightbox'])

// États : 'idle' | 'copying' | 'ok' | 'fail'
const copyState = ref('idle')
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
let longPressTimer = null

const copyLabel = computed(() => {
  if (copyState.value === 'copying') return 'Copie…'
  if (copyState.value === 'ok') return 'Copié !'
  if (copyState.value === 'downloaded') return 'Téléchargé !'
  if (copyState.value === 'fail') return 'Erreur'
  return 'Copier'
})

function formatDate(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function onImgError(e) {
  e.target.style.opacity = '0.3'
}

async function copyMeme() {
  copyState.value = 'copying'
  try {
    const result = await copyImageToClipboard(props.meme.url)
    copyState.value = result === 'downloaded' ? 'downloaded' : 'ok'
    emit('copied')
    setTimeout(() => { copyState.value = 'idle' }, 2000)
  } catch (e) {
    if (e?.name === 'AbortError') {
      copyState.value = 'idle'
    } else {
      copyState.value = 'fail'
      setTimeout(() => { copyState.value = 'idle' }, 2000)
    }
  }
}

function showCtxAt(x, y) {
  if (!props.isAdmin) return
  ctxX.value = Math.min(x, window.innerWidth - 170)
  ctxY.value = Math.min(y, window.innerHeight - 90)
  ctxVisible.value = true
}

function onRightClick(e) { showCtxAt(e.clientX, e.clientY) }

function onTouchStart(e) {
  if (!props.isAdmin) return
  const touch = e.touches[0]
  longPressTimer = setTimeout(() => showCtxAt(touch.clientX, touch.clientY), 600)
}
function onTouchEnd() { clearTimeout(longPressTimer) }
function cancelLongPress() { clearTimeout(longPressTimer) }

function onEditClick() { ctxVisible.value = false; emit('edit', props.meme) }
function onDeleteClick() { ctxVisible.value = false; emit('delete', props.meme.id) }
</script>

<style scoped>
.card {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: 10px;
  overflow: visible;
  position: relative;
  transition: border-color 0.15s, transform 0.18s, box-shadow 0.18s;
  user-select: none;
}
.card:hover {
  border-color: var(--purple-border);
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(124, 108, 240, 0.12);
}

.tags {
  padding: 7px 8px 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 30px;
  overflow: hidden;
  border-radius: 10px 10px 0 0;
}
.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 100px;
  background: var(--purple-bg);
  color: var(--purple-light);
  border: 0.5px solid var(--purple-border);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag.emotion {
  background: var(--green-bg);
  color: var(--green-light);
  border-color: var(--green-border);
}

.img-wrap {
  overflow: hidden;
  position: relative;
  cursor: pointer;
}
.img-wrap img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
  background: var(--bg-elevated);
}
.img-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}
.img-wrap:hover .img-overlay {
  opacity: 1;
  background: rgba(0,0,0,0.3);
}

.footer {
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.date {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}
.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 0.5px solid var(--border-hover);
  background: transparent;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.copy-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.copy-btn.success { color: var(--green-light); border-color: var(--green-border); }
.copy-btn.fail { color: var(--red-light); border-color: rgba(224,75,74,0.3); }
.copy-btn:disabled { cursor: default; }

.ctx-menu {
  position: fixed;
  background: var(--bg-surface);
  border: 0.5px solid var(--border-hover);
  border-radius: 10px;
  padding: 6px;
  z-index: 500;
  min-width: 160px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
}
.ctx-item:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.ctx-item.danger { color: var(--red-light); }
.ctx-item.danger:hover { background: var(--red-bg); }

.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 499;
}
</style>
