<template>
  <div class="scene-form">
    <!-- Indicador escena inicial -->
    <div v-if="isInitial" class="initial-banner">
      ★ Escena inicial — esta escena carga primero en el tour
    </div>

    <div class="form-section">
      <div class="form-row-2">
        <div>
          <div class="field-label">ID Escena</div>
          <input v-model="form.id" placeholder="escena-01" />
        </div>
        <div>
          <div class="field-label">Título</div>
          <input v-model="form.titulo" placeholder="Nombre visible" />
        </div>
      </div>

      <div class="form-row-2">
        <div>
          <div class="field-label">Modo</div>
          <select v-model="form.modo">
            <option value="tour">tour</option>
            <option value="walk">walk</option>
            <option value="look">look</option>
          </select>
        </div>
        <div>
          <div class="field-label">Velocidad</div>
          <input v-model.number="form.velocidad" type="number" min="1" max="50" placeholder="3" />
        </div>
      </div>
    </div>

    <div class="divider" />

    <!-- Fondo -->
    <div class="form-section">
      <div class="field-label">Fondo</div>
      <div class="type-selector">
        <button :class="['type-btn', { active: bgType === 'ninguno' }]" @click="bgType = 'ninguno'">
          ✕ Ninguno
        </button>
        <button :class="['type-btn', { active: bgType === 'imagen360' }]" @click="bgType = 'imagen360'">
          🖼 Panorama 360°
        </button>
        <button :class="['type-btn', { active: bgType === 'skybox' }]" @click="bgType = 'skybox'">
          🌐 Skybox
        </button>
      </div>

      <div v-if="bgType === 'imagen360'">
        <div class="field-label" style="margin-top:8px">Imagen 360°</div>
        <div class="asset-row">
          <input v-model="form.imagen360" placeholder="assets/images/360/foto.jpg" class="asset-input" readonly />
          <button class="btn btn-ghost btn-sm asset-pick" title="Seleccionar archivo" :disabled="picking" @click="pickImage">↑</button>
        </div>
        <!-- Thumbnail preview -->
        <div v-if="thumbSrc" class="img-thumb-wrap">
          <img
            :src="thumbSrc"
            class="img-thumb"
            :class="{ error: thumbError }"
            @load="thumbError = false"
            @error="thumbError = true"
          />
          <span v-if="thumbError" class="img-thumb-error">
            Imagen no encontrada — colócala en <code>public/viewer/{{ form.imagen360 }}</code>
          </span>
          <span v-else class="img-thumb-ok">✓ Vista previa</span>
        </div>
      </div>

      <!-- SKYBOX -->
      <div v-else-if="bgType === 'skybox'" style="margin-top:8px">
        <!-- Sub-tab: tipo de skybox -->
        <div class="type-selector" style="margin-bottom:10px">
          <button :class="['type-btn', { active: skyboxType === 'cubemap' }]" @click="skyboxType = 'cubemap'">
            ⬡ 6 Caras
          </button>
          <button :class="['type-btn', { active: skyboxType === 'equirect' }]" @click="skyboxType = 'equirect'">
            🌐 Equirectangular
          </button>
        </div>

        <!-- 6 caras del cubo -->
        <template v-if="skyboxType === 'cubemap'">
          <div class="field-label" style="margin-bottom:6px">
            6 caras del cubo
            <span style="color:#3f3f46;font-weight:400;text-transform:none"> · formatos: jpg, png, webp</span>
          </div>
          <div class="skybox-grid">
            <div v-for="face in SKYBOX_FACES" :key="face.key" class="skybox-face">
              <div class="field-label">{{ face.label }}</div>
              <div class="asset-row">
                <input
                  v-model="form.skybox[face.key]"
                  :placeholder="`assets/skybox/${face.key}.jpg`"
                  class="asset-input"
                  readonly
                />
                <button
                  class="btn btn-ghost btn-sm asset-pick"
                  :title="`Imagen para cara ${face.label}`"
                  :disabled="picking"
                  @click="pickSkyboxFace(face.key)"
                >↑</button>
              </div>
            </div>
          </div>
          <!-- Previsualización de caras cargadas -->
          <div class="skybox-thumbs">
            <div
              v-for="face in SKYBOX_FACES" :key="'thumb-' + face.key"
              class="skybox-thumb"
              :title="face.label"
            >
              <img
                v-if="getSkyboxSrc(face.key)"
                :src="getSkyboxSrc(face.key)"
                :alt="face.label"
              />
              <span v-else class="skybox-thumb-empty">{{ face.label }}</span>
            </div>
          </div>
        </template>

        <!-- Equirectangular panorama -->
        <template v-else>
          <div class="field-label" style="margin-bottom:6px">
            Imagen equirectangular
            <span style="color:#3f3f46;font-weight:400;text-transform:none"> · jpg, png, hdr, exr</span>
          </div>
          <div class="asset-row">
            <input v-model="form.skybox.equirectangular" placeholder="assets/skybox/panorama.jpg" class="asset-input" readonly />
            <button class="btn btn-ghost btn-sm asset-pick" title="Seleccionar imagen equirectangular" :disabled="picking" @click="pickEquirect">↑</button>
          </div>
          <div v-if="equirectSrc" class="img-thumb-wrap" style="margin-top:8px">
            <img :src="equirectSrc" class="img-thumb" />
            <span class="img-thumb-ok">✓ Vista previa</span>
          </div>
        </template>
      </div>

    </div>

    <div class="divider" />

    <!-- Modelo 3D (independiente del fondo, puede convivir con cualquier fondo) -->
    <div class="form-section">
      <div class="field-label">
        Modelo 3D
        <span style="color:#3f3f46;font-weight:400;text-transform:none"> · opcional · convive con el fondo</span>
      </div>
      <div class="asset-row">
        <input v-model="form.modelo3d" placeholder="assets/models/scene.glb" class="asset-input" readonly />
        <button class="btn btn-ghost btn-sm asset-pick" title="Seleccionar archivo .glb / .gltf" :disabled="picking" @click="pickModel">↑</button>
        <button
          v-if="form.modelo3d"
          class="btn btn-ghost btn-sm"
          style="flex-shrink:0"
          title="Quitar modelo"
          @click="form.modelo3d = ''"
        >✕</button>
      </div>
      <div v-if="form.modelo3d" class="form-row-3">
        <div>
          <div class="field-label">Posición</div>
          <input v-model="form.modeloPosicion" placeholder="0 0 0" />
        </div>
        <div>
          <div class="field-label">Escala</div>
          <input v-model="form.modeloEscala" placeholder="1 1 1" />
        </div>
        <div>
          <div class="field-label">Rotación</div>
          <input v-model="form.modeloRotacion" placeholder="0 0 0" />
        </div>
      </div>
    </div>

    <div class="divider" />

    <!-- Spawn + color -->
    <div class="form-section">
      <div class="form-row-2">
        <div>
          <div class="field-label">Spawn posición</div>
          <input v-model="form.spawnPosicion" placeholder="0 1.6 0" />
        </div>
        <div>
          <div class="field-label">Spawn rotación</div>
          <input v-model="form.spawnRotacion" placeholder="0 0 0" />
        </div>
      </div>
      <div>
        <div class="field-label">Color fallback</div>
        <div style="display:flex; gap:8px; align-items:center">
          <input type="color" v-model="form.colorFallback" style="width:36px;height:32px;padding:2px;flex-shrink:0" />
          <input v-model="form.colorFallback" placeholder="#1a1a2e" style="flex:1" />
        </div>
      </div>
    </div>

    <div class="divider" />

    <!-- Condición de acceso -->
    <div class="form-section">
      <div class="field-label">Condición de acceso <span style="color:#3f3f46;font-weight:400;text-transform:none">(vacío = libre)</span></div>
      <ConditionInput v-model="form.condicion_acceso" />
    </div>

    <div class="divider" />

    <!-- Acciones -->
    <div class="form-actions">
      <button
        v-if="!isInitial"
        class="btn btn-ghost btn-sm"
        title="Esta escena cargará primero en el tour"
        @click="$emit('set-initial')"
      >★ Hacer inicial</button>
      <button class="btn btn-ghost btn-sm" @click="reset">↺ Recargar</button>
      <button class="btn btn-primary btn-sm" @click="save">✓ Guardar escena</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import ConditionInput from './ConditionInput.vue'
import { registerAsset, getAssetUrl, hasAsset, loadExistingAsset } from '../stores/assetStore.js'

const props = defineProps({
  scene:     { type: Object, default: null },
  isInitial: { type: Boolean, default: false },
  tourId:    { type: String, required: true },
})
const emit = defineEmits(['save', 'set-initial'])

const SKYBOX_FACES = [
  { key: 'px', label: 'Right +X' },
  { key: 'nx', label: 'Left  -X' },
  { key: 'py', label: 'Top   +Y' },
  { key: 'ny', label: 'Bot   -Y' },
  { key: 'pz', label: 'Front +Z' },
  { key: 'nz', label: 'Back  -Z' },
]

const BLANK_SKYBOX = () => ({ px: '', nx: '', py: '', ny: '', pz: '', nz: '', equirectangular: '' })

const bgType    = ref('imagen360')
const skyboxType = ref('cubemap') // 'cubemap' | 'equirect'
const form      = ref({})
const picking   = ref(false)       // evita doble-click en diálogos

// ── Preview helpers ──────────────────────────────────────────────────────────

const thumbSrc = computed(() => {
  const p = form.value.imagen360
  if (!p) return null
  return hasAsset(p) ? getAssetUrl(p) : null
})
const thumbError = ref(false)

const equirectSrc = computed(() => {
  const p = form.value.skybox?.equirectangular
  if (!p) return null
  return hasAsset(p) ? getAssetUrl(p) : null
})

function getSkyboxSrc(faceKey) {
  const path = form.value.skybox?.[faceKey]
  if (!path) return null
  return hasAsset(path) ? getAssetUrl(path) : null
}

// ── File pickers (Tauri dialog → copy_asset → asset://) ──────────────────────
async function preloadAssets(s) {
  if (!s) return
  
  const promises = []
  
  // Si hay imagen 360, la cargamos
  if (s.imagen360) promises.push(loadExistingAsset(props.tourId, s.imagen360))
  
  // Si hay modelo 3D, lo cargamos
  if (s.modelo3d) promises.push(loadExistingAsset(props.tourId, s.modelo3d))
  
  // Si hay skybox, cargamos sus caras o su equirectangular
  if (s.skybox) {
    if (s.skybox.equirectangular) {
      promises.push(loadExistingAsset(props.tourId, s.skybox.equirectangular))
    }
    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
    for (const face of faces) {
      if (s.skybox[face]) promises.push(loadExistingAsset(props.tourId, s.skybox[face]))
    }
  }
  
  await Promise.all(promises)
}
async function pickImage() {
  if (picking.value) return
  picking.value = true
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imagen 360', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    })
    
    if (!selected) return // El usuario canceló la ventana
    
    // 1. Tauri copia el archivo, crea el Blob y lo guarda en el assetStore
    const { relativePath } = await registerAsset(props.tourId, selected)
    
    // 2. Actualizamos el formulario con la ruta virtual
    form.value.imagen360 = relativePath
    
    // 3. ✨ CRUCIAL: Guardamos y emitimos el cambio
    save()
  } catch (e) {
    console.error("Error al cargar imagen 360:", e)
  } finally {
    picking.value = false
  }
}

async function pickModel() {
  if (picking.value) return
  picking.value = true
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Modelos 3D', extensions: ['glb', 'gltf'] }],
    })
    if (!selected) return
    const { relativePath } = await registerAsset(props.tourId, selected)
    form.value.modelo3d = relativePath
    save()
  } finally {
    picking.value = false
  }
}

async function pickEquirect() {
  if (picking.value) return
  picking.value = true
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Panorama', extensions: ['jpg', 'jpeg', 'png', 'webp', 'hdr', 'exr'] }],
    })
    if (!selected) return
    const { relativePath } = await registerAsset(props.tourId, selected)
    if (!form.value.skybox) form.value.skybox = BLANK_SKYBOX()
    form.value.skybox.equirectangular = relativePath
    save()
  } finally {
    picking.value = false
  }
}

async function pickSkyboxFace(faceKey) {
  if (picking.value) return
  picking.value = true
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imagen', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    })
    if (!selected) return
    const { relativePath } = await registerAsset(props.tourId, selected)
    if (!form.value.skybox) form.value.skybox = BLANK_SKYBOX()
    form.value.skybox[faceKey] = relativePath
    save()
  } finally {
    picking.value = false
  }
}

// ── Reset / Save ─────────────────────────────────────────────────────────────

function reset() {
  const s = props.scene
  if (!s) return
  bgType.value = s.skybox && Object.values(s.skybox).some(v => !!v)
    ? 'skybox'
    : (s.imagen360 ? 'imagen360' : 'ninguno')
  if (s.skybox) {
    skyboxType.value = s.skybox.equirectangular ? 'equirect' : 'cubemap'
  }
  form.value = {
    id: s.id ?? '',
    titulo: s.titulo ?? '',
    modo: s.modo ?? 'tour',
    velocidad: s.velocidad ?? 3,
    imagen360: s.imagen360 ?? '',
    skybox: s.skybox ? { ...BLANK_SKYBOX(), ...s.skybox } : BLANK_SKYBOX(),
    modelo3d: s.modelo3d ?? '',
    modeloPosicion: s.modeloPosicion ?? '0 0 0',
    modeloEscala: s.modeloEscala ?? '1 1 1',
    modeloRotacion: s.modeloRotacion ?? '0 0 0',
    colorFallback: s.colorFallback ?? '#1a1a2e',
    spawnPosicion: s.spawnPosicion ?? '0 1.6 0',
    spawnRotacion: s.spawnRotacion ?? '0 0 0',
    condicion_acceso: s.condicion_acceso ?? null,
  }
}

watch(() => props.scene, async (newScene) => {
  reset() // 1. Configura los textos del form inmediatamente (síncrono)
  await preloadAssets(newScene) // 2. Genera las URLs Blob (asíncrono)
}, { immediate: true })

function save() {
  const out = { ...form.value }
  if (bgType.value === 'imagen360') {
    out.imagen360 = out.imagen360 || null
    out.skybox = null
  } else if (bgType.value === 'skybox') {
    out.imagen360 = null
    const sb = { ...out.skybox }
    if (skyboxType.value === 'equirect') {
      for (const k of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) sb[k] = null
      sb.equirectangular = sb.equirectangular || null
    } else {
      sb.equirectangular = null
      for (const k of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) if (!sb[k]) sb[k] = null
    }
    out.skybox = sb
  } else {
    out.imagen360 = null
    out.skybox = null
  }
  out.modelo3d = out.modelo3d || null
  emit('save', out)
  window.ptahToast?.('✓ Escena guardada')
}
</script>

<style scoped>
.scene-form { display: flex; flex-direction: column; gap: 0; }
.form-section { display: flex; flex-direction: column; gap: 10px; padding: 14px 0; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 14px; }

.type-selector { display: flex; gap: 6px; }
.type-btn {
  flex: 1; padding: 6px; border-radius: 5px; font-size: 11px;
  border: 1px solid var(--panel-border); background: var(--panel);
  color: #71717a; cursor: pointer; transition: all 0.12s; text-align: center;
}
.type-btn.active {
  border-color: rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.1);
  color: var(--accent);
}

/* Skybox */
.skybox-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;
}
.skybox-face { display: flex; flex-direction: column; gap: 4px; }

.skybox-thumbs {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; margin-top: 6px;
}
.skybox-thumb {
  aspect-ratio: 1; border-radius: 4px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--panel-border);
  display: flex; align-items: center; justify-content: center;
}
.skybox-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.skybox-thumb-empty { font-size: 7px; color: #52525b; text-align: center; padding: 2px; line-height: 1.2; }

/* Initial banner */
.initial-banner {
  margin: -14px -14px 0 -14px;
  padding: 8px 14px;
  background: rgba(251,191,36,0.08);
  border-bottom: 1px solid rgba(251,191,36,0.2);
  color: #fbbf24;
  font-size: 11px; font-weight: 500;
}

/* Asset picker */
.asset-row { display: flex; gap: 6px; }
.asset-input { flex: 1; }
.asset-pick { cursor: pointer; flex-shrink: 0; }

.img-thumb-wrap {
  position: relative; margin-top: 8px; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--panel-border); background: #0a0a0f;
  aspect-ratio: 2/1;
}
.img-thumb {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: opacity 0.15s;
}
.img-thumb.error { opacity: 0; }
.img-thumb-ok {
  position: absolute; bottom: 6px; right: 8px;
  font-size: 10px; color: var(--accent); background: rgba(0,0,0,0.5);
  padding: 2px 6px; border-radius: 3px;
}
.img-thumb-error {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #71717a; padding: 12px; text-align: center; line-height: 1.5;
}
.img-thumb-error code {
  background: var(--panel); padding: 1px 4px; border-radius: 3px;
  font-size: 10px; color: #a1a1aa;
}
</style>
