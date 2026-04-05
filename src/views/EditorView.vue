<template>
  <div class="editor" @keydown.ctrl.s.prevent="saveProject" tabindex="0">
    <!-- Top bar -->
    <header class="editor-header">
      <div class="editor-header-left">
        <button class="btn btn-ghost btn-sm" @click="goHome">← Volver</button>
        <div class="tour-name-wrap">
          <input
            class="tour-name-input"
            v-model="tourTitleEdit"
            @blur="saveTourTitle"
            @keydown.enter.prevent="saveTourTitle"
          />
        </div>
      </div>

      <div class="editor-header-right">
        <!-- Dirty / saving indicator -->
        <span v-if="store.isSaving" class="save-indicator saving">● Guardando…</span>
        <span v-else-if="store.isDirty" class="save-indicator dirty">● Sin guardar</span>
        <span v-else class="save-indicator saved">✓ Guardado</span>

        <!-- Autosave toggle -->
        <button
          :class="['btn btn-ghost btn-sm', { 'autosave-on': store.autosaveEnabled }]"
          :title="store.autosaveEnabled ? 'Autosave activo (cada 3 min)' : 'Activar autosave'"
          @click="toggleAutosave"
        >⏱ Auto</button>

        <!-- Historial -->
        <button class="btn btn-ghost btn-sm" title="Ver historial de guardados" @click="showHistory = !showHistory">
          ↺ Historial
        </button>

        <button class="btn btn-ghost btn-sm" :disabled="store.isSaving" @click="saveProject">
          💾 Guardar
        </button>

        <button class="btn btn-ghost btn-sm" @click="openFull">⬡ Preview</button>

        <button class="btn btn-primary btn-sm" @click="handleExport">↓ Exportar ZIP</button>
      </div>
    </header>

    <div class="editor-body">
      <!-- Left sidebar: scene list -->
      <aside class="sidebar-left">
        <SceneList
          :scenes="tour?.escenas ?? []"
          :active-id="store.activeSceneId"
          :initial-scene-id="tour?.escena_inicio ?? null"
          @select="selectScene"
          @add="addScene"
          @delete="deleteScene"
          @duplicate="duplicateScene"
          @move="moveScene"
          @set-initial="setInitialScene"
        />
      </aside>

      <!-- Center: preview -->
      <main class="editor-main">
        <PreviewPane
          ref="previewPane"
          :tour-id="tourId"
          @captured-spawn="onCapturedSpawn"
          @captured-hotspot="onCapturedHotspot"
          @hotspot-moved="onHotspotMoved"
        />
      </main>

      <!-- Drag handle -->
      <div
        class="resize-handle"
        :class="{ dragging: isResizing }"
        @mousedown="startResize"
      />

      <!-- Right sidebar: scene config + hotspot list -->
      <aside class="sidebar-right" :style="{ width: formWidth + 'px' }">
        <div v-if="activeScene" class="main-panels">
          <section class="panel">
            <div class="panel-header">
              <span class="panel-title">Configuración de escena</span>
            </div>
            <div class="panel-body">
              <SceneForm
                :scene="activeScene"
                :tour-id="tourId"
                :is-initial="activeScene?.id === tour?.escena_inicio"
                @save="saveScene"
                @set-initial="setInitialScene(activeScene?.id)"
              />
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <span class="panel-title">Hotspots</span>
            </div>
            <div class="panel-body">
              <HotspotList
                :hotspots="activeScene.hotspots ?? []"
                :active-id="editingHotspotId"
                @add="openHotspotForm(null)"
                @edit="openHotspotForm"
                @delete="deleteHotspot"
              />
            </div>
          </section>
        </div>

        <div v-else class="no-scene">
          Selecciona una escena para editar
        </div>
      </aside>
    </div>

    <!-- Hotspot form modal -->
    <HotspotForm
      :hotspot="editingHotspot"
      :visible="hotspotFormVisible"
      :tour-id="props.tourId"
      @save="saveHotspot"
      @close="closeHotspotForm"
    />

    <!-- History panel (overlay lateral) -->
    <Transition name="slide">
      <aside v-if="showHistory" class="history-panel">
        <div class="history-header">
          <span class="panel-title">Historial de guardados</span>
          <button class="btn btn-ghost btn-sm" @click="showHistory = false">✕</button>
        </div>
        <div v-if="historySnapshots.length === 0" class="history-empty">
          No hay snapshots aún
        </div>
        <ul v-else class="history-list">
          <li
            v-for="snap in historySnapshots"
            :key="snap"
            class="history-item"
            @click="restoreSnapshot(snap)"
          >
            <span class="history-date">{{ formatSnapDate(snap) }}</span>
            <button class="btn btn-ghost btn-sm history-restore">Restaurar</button>
          </li>
        </ul>
      </aside>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { save as dialogSave } from '@tauri-apps/plugin-dialog'
import { useTourStore } from '../stores/tourStore.js'
import SceneList from '../components/SceneList.vue'
import SceneForm from '../components/SceneForm.vue'
import HotspotList from '../components/HotspotList.vue'
import HotspotForm from '../components/HotspotForm.vue'
import PreviewPane from '../components/PreviewPane.vue'

const props = defineProps({ tourId: String })
const router = useRouter()
const store = useTourStore()

const tour = computed(() => store.activeTour)
const activeScene = computed(() => store.activeScene)

const tourTitleEdit = ref('')
const previewPane = ref(null)

// History
const showHistory = ref(false)
const historySnapshots = ref([])

watch(tour, (t) => {
  if (t) tourTitleEdit.value = t.titulo
}, { immediate: true })

watch(() => props.tourId, async (id) => {
  if (id && store.activeTourId !== id) await store.setActiveTour(id)
}, { immediate: true })

// Cargar historial cuando se abre el panel
watch(showHistory, async (open) => {
  if (open) historySnapshots.value = await store.listHistory(props.tourId)
})

function formatSnapDate(snap) {
  // snap = "2025-04-05T12-30-00" → "05/04/2025 12:30:00"
  return snap.replace('T', ' ').replace(/-(\d{2})-(\d{2})$/, ':$1:$2')
}

// ── Guardar ─────────────────────────────────────────────────────────────────

async function saveProject() {
  await store.saveCurrentProject()
  window.ptahToast?.('💾 Proyecto guardado')
}

function toggleAutosave() {
  store.setAutosave(!store.autosaveEnabled)
  window.ptahToast?.(store.autosaveEnabled ? '⏱ Autosave activado' : 'Autosave desactivado')
}

// Ctrl+S global (el div raíz tiene tabindex=0 pero puede que no tenga foco)
function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveProject()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ── Tour meta ────────────────────────────────────────────────────────────────

function goHome() {
  if (store.isDirty) {
    if (!confirm('Hay cambios sin guardar. ¿Salir de todas formas?')) return
  }
  router.push('/')
}

function saveTourTitle() {
  if (!tour.value) return
  store.updateTourMeta(props.tourId, { titulo: tourTitleEdit.value })
}

// ── Scenes ───────────────────────────────────────────────────────────────────

function selectScene(id) {
  store.activeSceneId = id
  previewPane.value?.sendUpdate()
}

function addScene() {
  const s = store.addScene(props.tourId)
  if (s) store.activeSceneId = s.id
  window.ptahToast?.('✓ Escena creada')
}

function deleteScene(id) {
  if (!confirm('¿Eliminar esta escena?')) return
  store.deleteScene(props.tourId, id)
  window.ptahToast?.('Escena eliminada')
}

function duplicateScene(id) {
  const s = store.duplicateScene(props.tourId, id)
  if (s) store.activeSceneId = s.id
  window.ptahToast?.('✓ Escena duplicada')
}

function moveScene(id, dir) {
  store.moveScene(props.tourId, id, dir)
}

function setInitialScene(id) {
  if (!id) return
  store.setInitialScene(props.tourId, id)
  window.ptahToast?.('★ Escena inicial establecida')
}

function saveScene(data) {
  store.updateScene(props.tourId, store.activeSceneId, data)
  if (data.id && data.id !== store.activeSceneId) {
    store.activeSceneId = data.id
  }
  previewPane.value?.sendUpdate()
}

// ── Hotspots ──────────────────────────────────────────────────────────────────

const hotspotFormVisible = ref(false)
const editingHotspot = ref(null)
const editingHotspotId = ref(null)

function openHotspotForm(hs = null) {
  editingHotspot.value = hs
  editingHotspotId.value = hs?.id ?? null
  hotspotFormVisible.value = true
}

function closeHotspotForm() {
  hotspotFormVisible.value = false
  editingHotspot.value = null
  editingHotspotId.value = null
}

function saveHotspot(data) {
  if (editingHotspotId.value) {
    store.updateHotspot(props.tourId, store.activeSceneId, editingHotspotId.value, data)
  } else {
    store.addHotspot(props.tourId, store.activeSceneId, data)
  }
  closeHotspotForm()
  previewPane.value?.sendHotspotsUpdate()
}

function deleteHotspot(id) {
  store.deleteHotspot(props.tourId, store.activeSceneId, id)
  window.ptahToast?.('Hotspot eliminado')
  previewPane.value?.sendHotspotsUpdate()
}

// ── God mode captures ─────────────────────────────────────────────────────────

function onCapturedSpawn({ position, rotation }) {
  if (!store.activeSceneId) return
  store.updateScene(props.tourId, store.activeSceneId, {
    spawnPosicion: position,
    spawnRotacion: rotation
  })
  window.ptahToast?.(`📍 Spawn → ${position}`)
}

function onCapturedHotspot({ position, rotation }) {
  openHotspotForm({ posicion: position, rotation })
}

function onHotspotMoved({ id, position }) {
  store.updateHotspot(props.tourId, store.activeSceneId, id, { posicion: position })
}

// ── Preview ───────────────────────────────────────────────────────────────────

function openFull() {
  previewPane.value?.openFull()
}

// ── Export ZIP ────────────────────────────────────────────────────────────────

async function handleExport() {
  // 1. Guardar cambios pendientes primero
  if (store.isDirty) await store.saveCurrentProject()

  // 2. Pedir destino al usuario
  const outputPath = await dialogSave({
    defaultPath: `${tour.value?.titulo ?? 'tour'}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })
  if (!outputPath) return

  // 3. Obtener JSON limpio del tour
  const tourJson = store.exportTourJson(props.tourId)
  if (!tourJson) return

  try {
    await invoke('export_zip', { tourId: props.tourId, tourJson, outputPath })
    window.ptahToast?.('✓ ZIP exportado correctamente')
  } catch (e) {
    window.ptahToast?.(`Error al exportar: ${e}`)
  }
}

// ── Historial ─────────────────────────────────────────────────────────────────

async function restoreSnapshot(snap) {
  if (!confirm(`¿Restaurar al snapshot del ${formatSnapDate(snap)}? Los cambios actuales se perderán.`)) return
  await store.restoreSnapshot(props.tourId, snap)
  showHistory.value = false
  window.ptahToast?.('↺ Snapshot restaurado')
  previewPane.value?.sendUpdate()
}

// ── Resizable form panel ───────────────────────────────────────────────────────

const FORM_WIDTH_KEY = 'ptah360_formWidth'
const _savedW = parseInt(localStorage.getItem(FORM_WIDTH_KEY) || '310', 10)
const formWidth = ref(isNaN(_savedW) ? 310 : _savedW)
const isResizing = ref(false)

function startResize(e) {
  isResizing.value = true
  const startX = e.clientX
  const startW = formWidth.value

  function onMove(ev) {
    const delta = startX - ev.clientX
    formWidth.value = Math.max(200, Math.min(700, startW + delta))
  }
  function onUp() {
    isResizing.value = false
    localStorage.setItem(FORM_WIDTH_KEY, String(formWidth.value))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}
</script>

<style scoped>
.editor { height: 100vh; display: flex; flex-direction: column; outline: none; }

.editor-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; height: 52px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel); flex-shrink: 0;
}
.editor-header-left, .editor-header-right { display: flex; align-items: center; gap: 10px; }

.tour-name-input {
  background: transparent; border: 1px solid transparent; color: #e4e4e7;
  font-size: 14px; font-weight: 600; padding: 4px 8px; border-radius: 5px;
  width: 220px;
}
.tour-name-input:hover { border-color: var(--panel-border); }
.tour-name-input:focus { border-color: var(--accent); background: var(--panel-light); }

/* Save indicator */
.save-indicator { font-size: 11px; min-width: 90px; text-align: right; }
.save-indicator.saved  { color: var(--accent); }
.save-indicator.dirty  { color: #fbbf24; }
.save-indicator.saving { color: #71717a; }

/* Autosave active state */
.autosave-on { border-color: rgba(52,211,153,0.4); color: var(--accent); }

.editor-body { flex: 1; display: flex; min-height: 0; position: relative; }

.sidebar-left {
  width: 310px; flex-shrink: 0;
  border-right: 1px solid var(--panel-border);
  overflow-y: auto; padding: 12px;
}

.editor-main {
  flex: 1; min-width: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
  padding: 12px;
}

.main-panels { display: flex; flex-direction: column; gap: 14px; }

.panel {
  background: var(--panel); border: 1px solid var(--panel-border);
  border-radius: 8px; overflow: hidden;
}
.panel-header {
  padding: 10px 14px; border-bottom: 1px solid var(--panel-border);
  display: flex; align-items: center;
}
.panel-title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #71717a; }
.panel-body { padding: 14px; }

.no-scene {
  display: flex; align-items: center; justify-content: center;
  height: 200px; color: #52525b; font-size: 13px;
}

/* Drag handle */
.resize-handle {
  width: 5px; flex-shrink: 0; cursor: col-resize;
  background: var(--panel-border);
  transition: background 0.15s;
  position: relative;
}
.resize-handle::after { content: ''; position: absolute; inset: 0 -4px; }
.resize-handle:hover, .resize-handle.dragging { background: var(--accent); }

/* Right sidebar */
.sidebar-right {
  flex-shrink: 0;
  border-left: 1px solid var(--panel-border);
  overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 14px;
}

/* History panel */
.history-panel {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 280px; z-index: 20;
  background: var(--panel);
  border-left: 1px solid var(--panel-border);
  display: flex; flex-direction: column;
  box-shadow: -4px 0 16px rgba(0,0,0,0.4);
}
.history-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid var(--panel-border);
}
.history-empty {
  padding: 20px 14px; color: #52525b; font-size: 12px; text-align: center;
}
.history-list { list-style: none; overflow-y: auto; flex: 1; }
.history-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--panel-border);
  cursor: pointer; transition: background 0.1s;
}
.history-item:hover { background: var(--panel-light); }
.history-date { font-size: 11px; color: #a1a1aa; font-family: monospace; }
.history-restore { font-size: 10px; }

/* Slide transition */
.slide-enter-active, .slide-leave-active { transition: transform 0.2s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
