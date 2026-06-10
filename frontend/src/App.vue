<template>
  <div class="app">
    <!-- Barre de navigation -->
    <header class="topbar">
      <div class="logo">data<span>meme</span></div>
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher par tag, texte, émotion…"
          @input="onSearch"
        />
      </div>
      <button class="admin-btn" @click="onAdminClick">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {{ auth.isLogged() ? 'Admin' : 'Connexion' }}
      </button>
    </header>

    <!-- Barre admin connecté -->
    <div v-if="auth.isLogged()" class="logged-bar">
      <span class="logged-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Connecté en admin
      </span>
      <div class="logged-actions">
        <button @click="showUpload = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Uploader
        </button>
        <button @click="showEmotions = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Émotions
        </button>
        <button @click="showPassword = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Mot de passe
        </button>
        <button class="logout" @click="logout">Déconnexion</button>
      </div>
    </div>

    <!-- Grille de mèmes -->
    <main class="grid" ref="gridEl">
      <MemeCard
        v-for="meme in memes"
        :key="meme.id"
        :meme="meme"
        :is-admin="auth.isLogged()"
        @delete="onDelete"
        @edit="onEdit"
        @copied="showToast('Image copiée !')"
      />
      <div v-if="loading" class="loading">
        <span class="spinner"></span>
      </div>
      <div v-if="!loading && memes.length === 0" class="empty">
        Aucun mème trouvé.
      </div>
    </main>

    <!-- Sentinel pour infinite scroll -->
    <div ref="sentinel" class="sentinel"></div>

    <!-- Modal connexion -->
    <Modal v-if="showLogin" @close="showLogin = false">
      <LoginForm @success="onLoginSuccess" />
    </Modal>

    <!-- Modal upload -->
    <Modal v-if="showUpload" @close="showUpload = false">
      <UploadForm :emotions="emotions" @uploaded="onUploaded" @close="showUpload = false" />
    </Modal>

    <!-- Modal émotions -->
    <Modal v-if="showEmotions" @close="showEmotions = false">
      <EmotionsManager :emotions="emotions" @updated="loadEmotions" />
    </Modal>

    <!-- Modal édition tags -->
    <Modal v-if="editingMeme" @close="editingMeme = null">
      <EditTagsForm :meme="editingMeme" :emotions="emotions" @saved="onTagsSaved" @close="editingMeme = null" />
    </Modal>

    <!-- Modal changement mot de passe -->
    <Modal v-if="showPassword" @close="showPassword = false">
      <PasswordForm @close="showPassword = false" />
    </Modal>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">{{ toastMessage }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { auth, getMemes, getEmotions, deleteMeme } from './api.js'
import MemeCard from './components/MemeCard.vue'
import Modal from './components/Modal.vue'
import LoginForm from './components/LoginForm.vue'
import UploadForm from './components/UploadForm.vue'
import EmotionsManager from './components/EmotionsManager.vue'
import EditTagsForm from './components/EditTagsForm.vue'
import PasswordForm from './components/PasswordForm.vue'

const memes = ref([])
const emotions = ref([])
const loading = ref(false)
const searchQuery = ref('')
const page = ref(1)
const hasMore = ref(true)

const showLogin = ref(false)
const showUpload = ref(false)
const showEmotions = ref(false)
const showPassword = ref(false)
const editingMeme = ref(null)

const sentinel = ref(null)
const gridEl = ref(null)
const toastMessage = ref('')
const toastVisible = ref(false)

let searchTimeout = null
let observer = null

function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  setTimeout(() => { toastVisible.value = false }, 2200)
}

async function loadMemes(reset = false) {
  if (loading.value || (!hasMore.value && !reset)) return
  if (reset) {
    page.value = 1
    hasMore.value = true
    memes.value = []
  }
  loading.value = true
  try {
    const data = await getMemes(page.value, searchQuery.value)
    memes.value = [...memes.value, ...data.memes]
    hasMore.value = data.memes.length === data.limit
    page.value++
  } catch (e) {
    showToast('Erreur de chargement')
  } finally {
    loading.value = false
  }
}

async function loadEmotions() {
  try {
    const data = await getEmotions()
    emotions.value = data.emotions
  } catch {}
}

function onSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadMemes(true), 350)
}

function onAdminClick() {
  if (auth.isLogged()) return
  showLogin.value = true
}

function onLoginSuccess() {
  showLogin.value = false
  showToast('Connecté en admin')
}

function logout() {
  auth.clear()
  showToast('Déconnecté')
}

async function onDelete(id) {
  if (!confirm('Supprimer ce mème définitivement ?')) return
  try {
    await deleteMeme(id)
    memes.value = memes.value.filter(m => m.id !== id)
    showToast('Mème supprimé')
  } catch {
    showToast('Erreur lors de la suppression')
  }
}

function onEdit(meme) {
  editingMeme.value = meme
}

function onTagsSaved(updated) {
  const idx = memes.value.findIndex(m => m.id === updated.id)
  if (idx !== -1) memes.value[idx] = updated
  editingMeme.value = null
  showToast('Tags mis à jour')
}

function onUploaded(uploaded) {
  showUpload.value = false
  memes.value = [...uploaded, ...memes.value]
  showToast(`${uploaded.length} mème(s) uploadé(s)`)
}

onMounted(async () => {
  await Promise.all([loadMemes(), loadEmotions()])

  // Infinite scroll via IntersectionObserver
  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !loading.value && hasMore.value) {
      loadMemes()
    }
  }, { rootMargin: '200px' })

  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  background: var(--bg-surface);
  border-bottom: 0.5px solid var(--border);
  padding: 0 20px;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.2px;
  white-space: nowrap;
}
.logo span { color: var(--purple-light); }

.search-wrap {
  flex: 1;
  max-width: 420px;
  position: relative;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}
.search-wrap input {
  width: 100%;
  height: 34px;
  background: var(--bg-base);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 0 12px 0 32px;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}
.search-wrap input:focus { border-color: var(--border-hover); }
.search-wrap input::placeholder { color: var(--text-muted); }

.admin-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0.5px solid var(--border-hover);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: background 0.15s;
}
.admin-btn:hover { background: rgba(255,255,255,0.05); }

.logged-bar {
  background: var(--purple-bg);
  border-bottom: 0.5px solid var(--purple-border);
  padding: 8px 20px;
  font-size: 12px;
  color: var(--purple-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.logged-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.logged-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.logged-actions button {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  color: var(--purple-light);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}
.logged-actions button:hover { background: rgba(255,255,255,0.06); }
.logged-actions .logout { color: var(--text-muted); }

.grid {
  padding: 24px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-items: start;
}

.loading {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 24px;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--purple-light);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-muted);
  padding: 48px;
  font-size: 14px;
}

.sentinel { height: 1px; }

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%) translateY(12px);
  background: var(--green);
  color: #E1F5EE;
  font-size: 13px;
  padding: 8px 18px;
  border-radius: 100px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  white-space: nowrap;
  z-index: 1000;
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
