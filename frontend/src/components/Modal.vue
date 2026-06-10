<template>
  <teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="box">
        <button class="close" @click="emit('close')" aria-label="Fermer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <slot />
      </div>
    </div>
  </teleport>
</template>

<script setup>
const emit = defineEmits(['close'])
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.box {
  background: var(--bg-surface);
  border: 0.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}
.close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s;
  line-height: 0;
}
.close:hover { color: var(--text-primary); }
</style>
