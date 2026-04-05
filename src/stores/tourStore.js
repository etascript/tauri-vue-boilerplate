import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { clearAssets, loadExistingAsset } from './assetStore'

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function blankScene(id, titulo) {
  return {
    id, titulo,
    modo: 'tour',
    imagen360: null, skybox: null, modelo3d: null,
    modeloPosicion: '0 0 0', modeloEscala: '1 1 1', modeloRotacion: '0 0 0',
    colorFallback: '#1a1a2e',
    spawnPosicion: '0 1.6 0', spawnRotacion: '0 0 0',
    velocidad: 3, condicion_acceso: null,
    hotspots: []
  }
}

/** Recoge todos los paths de assets referenciados en un tour */
function collectReferencedPaths(tour) {
  const paths = new Set()
  for (const escena of tour.escenas ?? []) {
    if (escena.imagen360) paths.add(escena.imagen360)
    if (escena.modelo3d) paths.add(escena.modelo3d)
    if (escena.skybox) {
      const sky = escena.skybox
      for (const key of ['px','nx','py','ny','pz','nz','equirectangular']) {
        if (sky[key]) paths.add(sky[key])
      }
    }
    for (const hs of escena.hotspots ?? []) {
      if (hs.contenido?.imagen) paths.add(hs.contenido.imagen)
    }
  }
  return [...paths]
}

export const useTourStore = defineStore('tours', () => {
  // Lista de metadatos de proyectos (cargada desde AppData al inicio)
  const projects = ref([])  // ProjectMeta[]
  const activeTourId = ref(null)
  const activeSceneId = ref(null)

  // Tour activo cargado en memoria
  const activeTourData = ref(null)

  // Estado de guardado
  const isDirty = ref(false)
  const isSaving = ref(false)
  const autosaveEnabled = ref(false)
  let autosaveTimer = null

  // ── Computed ──────────────────────────────────────────────────────────────

  const activeTour = computed(() => activeTourData.value)
  const activeScene = computed(() =>
    activeTourData.value?.escenas?.find(s => s.id === activeSceneId.value) ?? null
  )

  // Para compatibilidad con HomeView que lista todos los tours
  const tours = computed(() => projects.value)

  // ── Inicialización ────────────────────────────────────────────────────────

  async function init() {
    await refreshProjectList()
  }

  async function refreshProjectList() {
    try {
      projects.value = await invoke('list_projects')
    } catch (e) {
      console.error('[tourStore] Error listando proyectos:', e)
      projects.value = []
    }
  }

  // ── Persistencia ──────────────────────────────────────────────────────────

  /** Marca el tour como modificado y arranca el timer de autosave si está activo */
  function _markDirty() {
    isDirty.value = true
    if (autosaveEnabled.value) _resetAutosaveTimer()
  }

  function _resetAutosaveTimer() {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveCurrentProject(), 3 * 60 * 1000) // 3 min
  }

  /** Guarda el proyecto activo en disco */
  async function saveCurrentProject() {
    if (!activeTourData.value) return
    isSaving.value = true
    try {
      const json = JSON.stringify(activeTourData.value)
      await invoke('save_project', { tourId: activeTourData.value.id, json })

      // Limpiar assets huérfanos en cada guardado
      const referencedPaths = collectReferencedPaths(activeTourData.value)
      await invoke('cleanup_orphan_assets', {
        tourId: activeTourData.value.id,
        referencedPaths,
      })

      isDirty.value = false
      await refreshProjectList()
    } finally {
      isSaving.value = false
    }
  }

  function setAutosave(enabled) {
    autosaveEnabled.value = enabled
    if (!enabled && autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
  }

  // ── Ciclo de vida de proyectos ────────────────────────────────────────────

  async function createTour(titulo = 'Nuevo Tour') {
    const firstScene = blankScene('escena-01', 'Escena 1')
    const tour = {
      id: uid('tour'), titulo,
      version: '2.0',
      createdAt: Date.now(), updatedAt: Date.now(),
      estado_inicial: { puntuacion: 0, vars: {} },
      escena_inicio: firstScene.id,
      escenas: [firstScene]
    }
    // Crear estructura de directorios en AppData
    await invoke('create_project_dirs', { tourId: tour.id })
    // Guardar .ptah inicial
    await invoke('save_project', { tourId: tour.id, json: JSON.stringify(tour) })
    await refreshProjectList()
    return tour
  }

  async function deleteTour(id) {
    await invoke('delete_project', { tourId: id })
    if (activeTourId.value === id) {
      activeTourId.value = null
      activeTourData.value = null
      activeSceneId.value = null
      clearAssets()
    }
    await refreshProjectList()
  }

  async function setActiveTour(id) {
    // Guardar el anterior si tiene cambios
    if (isDirty.value && activeTourData.value) {
      await saveCurrentProject()
    }

    clearAssets()
    activeTourId.value = id

    // Cargar desde disco
    const json = await invoke('load_project', { tourId: id })
    activeTourData.value = JSON.parse(json)
    activeSceneId.value = activeTourData.value?.escenas?.[0]?.id ?? null
    isDirty.value = false

    // Pre-cargar assets en el store (registro sin copia)
    _preloadAssets(activeTourData.value)
  }

  async function _preloadAssets(tour) {
    const paths = collectReferencedPaths(tour)
    for (const p of paths) {
      await loadExistingAsset(tour.id, p).catch(() => {})
    }
  }

  async function updateTourMeta(id, patch) {
    if (activeTourData.value?.id === id) {
      Object.assign(activeTourData.value, patch, { updatedAt: Date.now() })
      _markDirty()
    }
  }

  async function importTour(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      const tour = { ...data, id: uid('tour'), createdAt: Date.now(), updatedAt: Date.now() }
      await invoke('create_project_dirs', { tourId: tour.id })
      await invoke('save_project', { tourId: tour.id, json: JSON.stringify(tour) })
      await refreshProjectList()
      return tour
    } catch { return null }
  }

  // ── Scenes ────────────────────────────────────────────────────────────────

  function addScene(tourId, titulo = 'Nueva Escena') {
    if (!activeTourData.value || activeTourData.value.id !== tourId) return null
    const s = blankScene(uid('escena'), titulo)
    activeTourData.value.escenas.push(s)
    activeTourData.value.updatedAt = Date.now()
    _markDirty()
    return s
  }

  function duplicateScene(tourId, sceneId) {
    if (!activeTourData.value) return null
    const src = activeTourData.value.escenas.find(s => s.id === sceneId)
    if (!src) return null
    const copy = JSON.parse(JSON.stringify(src))
    copy.id = uid('escena')
    copy.titulo = src.titulo + ' (copia)'
    copy.hotspots = copy.hotspots.map(h => ({ ...h, id: uid('hs') }))
    const idx = activeTourData.value.escenas.indexOf(src)
    activeTourData.value.escenas.splice(idx + 1, 0, copy)
    activeTourData.value.updatedAt = Date.now()
    _markDirty()
    return copy
  }

  function updateScene(tourId, sceneId, patch) {
    if (!activeTourData.value) return
    const idx = activeTourData.value.escenas.findIndex(s => s.id === sceneId)
    if (idx === -1) return
    activeTourData.value.escenas[idx] = { ...activeTourData.value.escenas[idx], ...patch }
    activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  function deleteScene(tourId, sceneId) {
    if (!activeTourData.value || activeTourData.value.escenas.length <= 1) return
    activeTourData.value.escenas = activeTourData.value.escenas.filter(s => s.id !== sceneId)
    activeTourData.value.updatedAt = Date.now()
    if (activeSceneId.value === sceneId) activeSceneId.value = activeTourData.value.escenas[0].id
    _markDirty()
  }

  function moveScene(tourId, sceneId, direction) {
    if (!activeTourData.value) return
    const arr = activeTourData.value.escenas
    const idx = arr.findIndex(s => s.id === sceneId)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= arr.length) return
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  // ── Hotspots ──────────────────────────────────────────────────────────────

  function _scene(tourId, sceneId) {
    return activeTourData.value?.escenas.find(s => s.id === sceneId) ?? null
  }

  function addHotspot(tourId, sceneId, hotspot) {
    const s = _scene(tourId, sceneId)
    if (!s) return
    if (!s.hotspots) s.hotspots = []
    s.hotspots.push({ ...hotspot, id: hotspot.id || uid('hs') })
    if (activeTourData.value) activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  function updateHotspot(tourId, sceneId, hotspotId, patch) {
    const s = _scene(tourId, sceneId)
    if (!s) return
    const idx = s.hotspots.findIndex(h => h.id === hotspotId)
    if (idx === -1) return
    s.hotspots[idx] = { ...s.hotspots[idx], ...patch }
    if (activeTourData.value) activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  function deleteHotspot(tourId, sceneId, hotspotId) {
    const s = _scene(tourId, sceneId)
    if (!s) return
    s.hotspots = s.hotspots.filter(h => h.id !== hotspotId)
    if (activeTourData.value) activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  // ── Initial scene ─────────────────────────────────────────────────────────

  function setInitialScene(tourId, sceneId) {
    if (!activeTourData.value) return
    if (!activeTourData.value.escenas.find(s => s.id === sceneId)) return
    activeTourData.value.escena_inicio = sceneId
    activeTourData.value.updatedAt = Date.now()
    _markDirty()
  }

  // ── Preview (pasa el tour al viewer en dev via localStorage) ──────────────

  function setPreview(tourId) {
    if (!activeTourData.value) return
    localStorage.setItem('ptah360_preview', JSON.stringify(activeTourData.value))
  }

  // ── Historial ─────────────────────────────────────────────────────────────

  async function listHistory(tourId) {
    return invoke('list_history', { tourId })
  }

  async function restoreSnapshot(tourId, snapshot) {
    const json = await invoke('load_history_snapshot', { tourId, snapshot })
    activeTourData.value = JSON.parse(json)
    activeSceneId.value = activeTourData.value?.escenas?.[0]?.id ?? null
    isDirty.value = true // marcar como dirty para que el usuario confirme el guardado
    await _preloadAssets(activeTourData.value)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Retorna el JSON limpio del tour (sin campos internos) para el ZIP de exportación */
  function exportTourJson(tourId) {
    const t = activeTourData.value
    if (!t || t.id !== tourId) return null
    const { id: _id, createdAt: _c, updatedAt: _u, ...clean } = t
    return JSON.stringify(clean, null, 2)
  }

  return {
    // State
    tours, projects, activeTourId, activeSceneId, activeTour, activeScene,
    isDirty, isSaving, autosaveEnabled,
    // Lifecycle
    init, refreshProjectList, setActiveTour, createTour, deleteTour, importTour, updateTourMeta,
    // Save
    saveCurrentProject, setAutosave,
    // Scenes
    addScene, duplicateScene, updateScene, deleteScene, moveScene,
    // Hotspots
    addHotspot, updateHotspot, deleteHotspot,
    // Misc
    setInitialScene, setPreview, exportTourJson,
    // History
    listHistory, restoreSnapshot,
  }
})
