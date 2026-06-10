<template>
  <teleport to="body">
    <div class="lightbox" @click.self="emit('close')" @keydown.escape="emit('close')">
      <!-- Fermer -->
      <button class="close-btn" @click="emit('close')" aria-label="Fermer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <!-- Image -->
      <div class="img-container" @click.self="emit('close')">
        <img :src="meme.url" :alt="meme.filename" @click.stop />
      </div>

      <!-- Barre basse -->
      <div class="bar">
        <div class="bar-tags">
          <span v-for="tag in meme.tags" :key="tag" class="tag">{{ tag }}</span>
          <span v-for="em in meme.emotions" :key="em" class="tag emotion">{{ em }}</span>
        </div>
        <div class="bar-actions">
          <a :href="meme.url" target="_blank" rel="noopener" class="action-btn" aria-label="Ouvrir l'URL">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            URL
          </a>
          <button
            class="action-btn"
            :class="{ success: copyState === 'ok', fail: copyState === 'fail' }"
            @click="copyMeme"
            :disabled="copyState !== 'idle'"
          >
            <svg v-if="copyState !== 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            {{ copyState === 'ok' ? 'Copié !' : copyState === 'fail' ? 'Non supporté' : 'Copier' }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { copyImageToClipboard } from '../copyImage.js'

const props = defineProps({ meme: Object })
const emit = defineEmits(['close'])

const copyState = ref('idle')

async function copyMeme() {
  copyState.value = 'copying'
  try {
    await copyImageToClipboard(props.meme.url)
    copyState.value = 'ok'
  } catch {
    copyState.value = 'fail'
  } finally {
    setTimeout(() => { copyState.value = 'idle' }, 2000)
  }
}

// Fermer avec Escape
function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.92);
  z-index: 800;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255,255,255,0.08);
  border: none;
  color: white;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s;
}
.close-btn:hover { background: rgba(255,255,255,0.16); }

.img-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 56px 16px 8px;
  overflow: hidden;
}
.img-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  cursor: default;
}

.bar {
  width: 100%;
  padding: 10px 16px;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.bar-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
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

.bar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 7px;
  border: 0.5px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  transition: background 0.15s;
  cursor: pointer;
}
.action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: white; }
.action-btn.success { color: var(--green-light); border-color: var(--green-border); }
.action-btn.fail { color: var(--red-light); }
.action-btn:disabled { cursor: default; }
</style>
