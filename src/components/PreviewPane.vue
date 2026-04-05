<template>
  <div class="preview-pane">
    <!-- Header normal -->
    <div class="preview-header">
      <span class="preview-title">Preview</span>
      <div class="preview-actions">
        <span v-if="status" class="preview-status">{{ status }}</span>
        <button
          class="btn btn-sm"
          :class="godMode ? 'btn-god-active' : 'btn-ghost'"
          @click="toggleGodMode"
          title="Modo dios: cámara libre + captura de coordenadas"
        >⬡ {{ godMode ? 'Modo Editor ON' : 'Modo Editor' }}</button>
        <button class="btn btn-ghost btn-sm" @click="sendUpdate">↺</button>
        <button class="btn btn-primary btn-sm" @click="openFull">Abrir</button>
      </div>
    </div>

    <!-- Toolbar del modo editor -->
    <Transition name="toolbar">
      <div v-if="godMode" class="god-toolbar">
        <span class="god-label">WASD mover · arrastrar mirar · arrastra hotspot (XY) · scroll sobre hotspot (profundidad)</span>
        <div class="god-actions">
          <button class="btn btn-ghost btn-sm" @click="captureSpawn"
            title="Captura posición y rotación actual como spawn de la escena">
            📍 Spawn
          </button>
          <button
            class="btn btn-sm"
            :class="placeMode ? 'btn-place-active' : 'btn-ghost'"
            @click="togglePlaceMode"
            title="Clic en la escena 3D para colocar hotspot exactamente donde quieres"
          >⊕ {{ placeMode ? 'Cancelar colocación' : 'Colocar hotspot' }}</button>
        </div>
      </div>
    </Transition>

    <!-- iframe -->
    <div class="preview-frame-wrap">
      <iframe
        ref="frame"
        src="/viewer/index.html"
        class="preview-frame"
        allow="vr; xr; accelerometer; gyroscope"
        @load="onFrameLoad"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useTourStore } from '../stores/tourStore.js'
import { assets } from '../stores/assetStore.js'

const props = defineProps({
  tourId: { type: String, default: null }
})
const emit = defineEmits(['captured-spawn', 'captured-hotspot', 'hotspot-moved'])

const store = useTourStore()
const frame = ref(null)
const status = ref('')
const godMode   = ref(false)
const placeMode = ref(false)
let frameReady = false
let _popupWindow = null

// ── Mensajes del viewer ──────────────────────────────────────────────────────
function onMessage(e) {
  if (e.data?.type === 'ptah360:ready') {
    if (e.source === frame.value?.contentWindow) {
      // From inline iframe
      frameReady = true
      sendUpdate()
      if (godMode.value) _sendGodMode(true)
    } else if (e.source === _popupWindow) {
      // From popup — push all assets + tour
      _sendUpdateToWindow(_popupWindow)
    }
  }

  if (e.data?.type === 'ptah360:captured') {
    if (e.data.captureType === 'spawn') {
      emit('captured-spawn', { position: e.data.position, rotation: e.data.rotation })
      flashStatus('📍 Spawn capturado')
    }
    if (e.data.captureType === 'hotspot') {
      emit('captured-hotspot', { position: e.data.position, rotation: e.data.rotation })
      flashStatus('⊕ Posición lista')
    }
  }

  if (e.data?.type === 'ptah360:place-mode-done') {
    placeMode.value = false
  }

  if (e.data?.type === 'ptah360:hotspot-moved' && e.source === frame.value?.contentWindow) {
    emit('hotspot-moved', { id: e.data.id, position: e.data.position })
    flashStatus('↔ Hotspot movido')
  }
}

// Auto-sync hotspots to preview whenever they change in the store
watch(
  () => store.activeScene?.hotspots,
  (hotspots) => { if (hotspots) sendHotspotsUpdate(hotspots) },
  { deep: true }
)

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))

function onFrameLoad() {
  frameReady = false
}

// ── Preview update ───────────────────────────────────────────────────────────
function sendUpdate() {
  const tour = store.activeTour
  if (!frameReady || !tour || !frame.value?.contentWindow) return
  const win = frame.value.contentWindow

  for (const [path, { url }] of assets) {
    win.postMessage({ type: 'ptah360:asset', path, url }, '*')
  }

  win.postMessage({ type: 'ptah360:load', tour: JSON.parse(JSON.stringify(tour)), activeSceneId: store.activeSceneId }, '*')
  flashStatus('✓ Actualizado')
}

function flashStatus(msg) {
  status.value = msg
  setTimeout(() => { status.value = '' }, 2000)
}

function sendGotoScene(sceneId) {
  frame.value?.contentWindow?.postMessage({ type: 'ptah360:goto-scene', sceneId }, '*')
}

function _sendUpdateToWindow(win) {
  const tour = store.activeTour
  if (!tour || !win) return
  for (const [path, { url }] of assets) {
    win.postMessage({ type: 'ptah360:asset', path, url }, '*')
  }
  win.postMessage({ type: 'ptah360:load', tour: JSON.parse(JSON.stringify(tour)), activeSceneId: store.activeSceneId }, '*')
}

function openFull() {
  const popup = window.open('/viewer/index.html', '_blank')
  if (popup) _popupWindow = popup
}

// ── Modo dios ────────────────────────────────────────────────────────────────
function _sendGodMode(enabled) {
  frame.value?.contentWindow?.postMessage({ type: 'ptah360:editor-mode', enabled }, '*')
}

function toggleGodMode() {
  godMode.value = !godMode.value
  if (!godMode.value && placeMode.value) {
    placeMode.value = false
    frame.value?.contentWindow?.postMessage({ type: 'ptah360:place-mode', enabled: false }, '*')
  }
  _sendGodMode(godMode.value)
  if (!godMode.value) flashStatus('Modo editor OFF')
}

function togglePlaceMode() {
  placeMode.value = !placeMode.value
  frame.value?.contentWindow?.postMessage(
    { type: 'ptah360:place-mode', enabled: placeMode.value }, '*'
  )
}

function captureSpawn() {
  if (!godMode.value) return
  frame.value?.contentWindow?.postMessage({ type: 'ptah360:capture', captureType: 'spawn' }, '*')
  flashStatus('Capturando...')
}

function sendHotspotsUpdate() {
  if (!frameReady || !frame.value?.contentWindow) return
  const hotspots = JSON.parse(JSON.stringify(store.activeScene?.hotspots || []))
  frame.value.contentWindow.postMessage({ type: 'ptah360:hotspots', hotspots }, '*')
}

defineExpose({ sendUpdate, sendHotspotsUpdate, openFull, sendGotoScene })
</script>

<style scoped>
.preview-pane {
  display: flex; flex-direction: column;
  background: #0a0a0f; border: 1px solid var(--panel-border);
  border-radius: 8px; overflow: hidden; height: 100%;
}

.preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; border-bottom: 1px solid var(--panel-border);
  background: var(--panel); flex-shrink: 0;
}
.preview-title { font-size: 11px; font-weight: 600; color: #71717a; letter-spacing: 0.08em; }
.preview-actions { display: flex; align-items: center; gap: 5px; }
.preview-status { font-size: 11px; color: var(--accent); }

/* Place mode active button */
.btn-place-active {
  background: rgba(0,229,255,0.15);
  border: 1px solid rgba(0,229,255,0.5);
  color: #00e5ff;
  padding: 4px 10px; border-radius: 5px; font-size: 12px;
  font-weight: 600; cursor: pointer;
  animation: pulse-place 1.5s ease-in-out infinite;
}
@keyframes pulse-place {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,255,0.4); }
  50%       { box-shadow: 0 0 0 4px rgba(0,229,255,0); }
}

/* God mode active button */
.btn-god-active {
  background: rgba(52,211,153,0.15);
  border: 1px solid rgba(52,211,153,0.5);
  color: var(--accent);
  padding: 4px 10px; border-radius: 5px; font-size: 12px;
  font-weight: 600; cursor: pointer;
}

/* God mode toolbar */
.god-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(52,211,153,0.06);
  border-bottom: 1px solid rgba(52,211,153,0.15);
  flex-shrink: 0;
}
.god-label { font-size: 10px; color: rgba(52,211,153,0.6); letter-spacing: 0.08em; font-family: monospace; }
.god-actions { display: flex; gap: 5px; }

/* Toolbar transition */
.toolbar-enter-active, .toolbar-leave-active { transition: all 0.15s ease; overflow: hidden; }
.toolbar-enter-from, .toolbar-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.toolbar-enter-to, .toolbar-leave-from { opacity: 1; max-height: 48px; }

.preview-frame-wrap { flex: 1; position: relative; }
.preview-frame { width: 100%; height: 100%; border: none; display: block; }
</style>
