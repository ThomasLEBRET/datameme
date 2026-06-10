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

    <!-- Image -->
    <div class="img-wrap">
      <img
        :src="meme.url"
        :alt="meme.filename"
        loading="lazy"
        @error="onImgError"
      />
    </div>

    <!-- Footer -->
    <div class="footer">
      <span class="date">{{ formatDate(meme.created_at) }}</span>
      <button class="copy-btn" @click.stop="copyMeme" :disabled="copying">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {{ copying ? 'Copié !' : 'Copier' }}
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

  <!-- Overlay pour fermer le menu contextuel -->
  <teleport to="body">
    <div v-if="ctxVisible" class="ctx-overlay" @click="ctxVisible = false" @contextmenu.prevent="ctxVisible = false"></div>
  </teleport>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  meme: Object,
  isAdmin: Boolean,
})
const emit = defineEmits(['delete', 'edit', 'copied'])

const copying = ref(false)
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
let longPressTimer = null

function formatDate(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function onImgError(e) {
  e.target.style.opacity = '0.3'
}

async function copyMeme() {
  copying.value = true
  try {
    const res = await fetch(props.meme.url)
    const blob = await res.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ])
    emit('copied')
  } catch {
    // Fallback — ouvrir l'image dans un nouvel onglet
    window.open(props.meme.url, '_blank')
  } finally {
    setTimeout(() => { copying.value = false }, 1500)
  }
}

function showCtxAt(x, y) {
  if (!props.isAdmin) return
  // Évite que le menu sorte de l'écran
  ctxX.value = Math.min(x, window.innerWidth - 170)
  ctxY.value = Math.min(y, window.innerHeight - 90)
  ctxVisible.value = true
}

function onRightClick(e) {
  showCtxAt(e.clientX, e.clientY)
}

function onTouchStart(e) {
  if (!props.isAdmin) return
  const touch = e.touches[0]
  longPressTimer = setTimeout(() => {
    showCtxAt(touch.clientX, touch.clientY)
  }, 600)
}

function onTouchEnd() {
  clearTimeout(longPressTimer)
}

function cancelLongPress() {
  clearTimeout(longPressTimer)
}

function onEditClick() {
  ctxVisible.value = false
  emit('edit', props.meme)
}

function onDeleteClick() {
  ctxVisible.value = false
  emit('delete', props.meme.id)
}
</script>

<style scoped>
.card {
  background: var(--bg-surface);
  border: 0.5px solid var(--border);
  border-radius: 12px;
  overflow: visible;
  position: relative;
  transition: border-color 0.15s;
  user-select: none;
}
.card:hover { border-color: var(--border-hover); }

.tags {
  padding: 10px 10px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 36px;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 100px;
  background: var(--purple-bg);
  color: var(--purple-light);
  border: 0.5px solid var(--purple-border);
}
.tag.emotion {
  background: var(--green-bg);
  color: var(--green-light);
  border-color: var(--green-border);
}

.img-wrap {
  overflow: hidden;
}
.img-wrap img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
  background: var(--bg-elevated);
  transition: opacity 0.2s;
}

.footer {
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.date {
  font-size: 11px;
  color: var(--text-muted);
}
.copy-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 0.5px solid var(--border-hover);
  background: transparent;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
}
.copy-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.copy-btn:disabled { opacity: 0.7; }

/* Menu contextuel — positionné en fixed pour sortir du overflow:hidden */
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
  transition: background 0.15s;
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
