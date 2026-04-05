<template>
  <Transition name="toast">
    <div v-if="visible" class="toast">{{ message }}</div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
let timer = null

function show(msg) {
  message.value = msg
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { visible.value = false }, 2500)
}

// Global event bus — call window.ptahToast('msg')
if (typeof window !== 'undefined') {
  window.ptahToast = show
}
</script>

<style scoped>
.toast {
  position: fixed; bottom: 24px; right: 24px;
  background: #28282c; border: 1px solid #3a3a3e;
  color: #e4e4e7; padding: 10px 16px;
  border-radius: 7px; font-size: 13px;
  z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateY(8px); }
.toast-leave-to   { opacity: 0; transform: translateY(8px); }
</style>
