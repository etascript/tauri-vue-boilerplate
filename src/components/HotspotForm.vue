<template>
  <div class="hs-form-overlay" v-if="visible" @click.self="close">
    <div class="hs-form">
      <div class="hs-form-header">
        <span>{{ editingId ? 'EDITAR HOTSPOT' : 'NUEVO HOTSPOT' }}</span>
        <button class="icon-btn" @click="close">✕</button>
      </div>

      <!-- Base fields -->
      <div class="form-section">
        <div class="form-row-2">
          <div>
            <div class="field-label">ID</div>
            <input v-model="form.id" placeholder="hs-punto-1" />
          </div>
          <div>
            <div class="field-label">Etiqueta</div>
            <input v-model="form.etiqueta" placeholder="Texto del botón" />
          </div>
        </div>
        <div>
          <div class="field-label">Posición (x y z)</div>
          <input v-model="form.posicion" placeholder="0 1.6 -3" />
        </div>
      </div>

      <div class="divider" />

      <!-- Type selector -->
      <div class="form-section">
        <div class="field-label">Tipo</div>
        <div class="type-grid">
          <button
            v-for="t in TYPES" :key="t"
            :class="['type-btn', 'type-btn-' + t, { active: form.tipo === t }]"
            @click="changeTipo(t)"
          >{{ t }}</button>
        </div>
      </div>

      <div class="divider" />

      <!-- Dynamic fields -->
      <div class="form-section">

        <!-- INFO -->
        <template v-if="form.tipo === 'info'">
          <div>
            <div class="field-label">Título</div>
            <input v-model="form.contenido.titulo" placeholder="Título del panel" />
          </div>
          <div>
            <div class="field-label">Texto</div>
            <textarea v-model="form.contenido.texto" placeholder="Descripción..." rows="3" />
          </div>
          <div>
            <div class="field-label">Imagen (opcional)</div>
            <input v-model="form.contenido.imagen" placeholder="assets/images/foto.jpg" />
          </div>
        </template>

        <!-- TRIVIA -->
        <template v-else-if="form.tipo === 'trivia'">
          <div>
            <div class="field-label">Pregunta</div>
            <input v-model="form.contenido.pregunta" placeholder="¿Cuál es la respuesta?" />
          </div>
          <div v-for="(op, i) in form.contenido.opciones" :key="i" class="trivia-option">
            <div class="field-label">Opción {{ i + 1 }}</div>
            <div class="trivia-row">
              <input v-model="op.texto" :placeholder="`Opción ${i + 1}`" style="flex:3" />
              <label class="trivia-correct">
                <input type="radio" :name="'correct-' + form.id" :checked="op.correcta" @change="setCorrect(i)" />
                <span>correcta</span>
              </label>
              <button class="icon-btn danger" @click="removeOption(i)" :disabled="form.contenido.opciones.length <= 2">✕</button>
            </div>
            <div style="display:flex; gap:6px; margin-top:4px">
              <div style="flex:1">
                <div class="field-label">Retroalimentación</div>
                <input v-model="op.retroalimentacion" placeholder="Respuesta..." />
              </div>
              <div>
                <div class="field-label">Puntos</div>
                <input v-model.number="op.puntos" type="number" style="width:60px" />
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="addOption">+ Opción</button>
        </template>

        <!-- DECISION -->
        <template v-else-if="form.tipo === 'decision'">
          <div>
            <div class="field-label">Título</div>
            <input v-model="form.contenido.titulo" placeholder="¿Qué decides?" />
          </div>
          <div>
            <div class="field-label">Descripción</div>
            <textarea v-model="form.contenido.descripcion" placeholder="Contexto..." rows="2" />
          </div>
          <div v-for="(op, i) in form.contenido.opciones" :key="i" class="decision-option">
            <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px">
              <div class="field-label" style="flex:1;margin:0">Opción {{ i + 1 }}</div>
              <button class="icon-btn danger" @click="removeDecisionOption(i)" :disabled="form.contenido.opciones.length <= 2">✕</button>
            </div>
            <input v-model="op.texto" :placeholder="`Texto visible de la opción`" />
            <div class="effects-block">
              <div class="effects-header">Acciones al elegir esta opción</div>
              <div v-if="!op.efectos.length" class="effects-empty">Sin acciones — se cierra el panel</div>
              <div v-for="(ef, ei) in op.efectos" :key="ei" class="effect-row">
                <select :value="ef.tipo" @change="onEffectTypeChange(op, ei, $event.target.value)" class="effect-type-sel">
                  <option value="ir_escena">→ Ir a escena</option>
                  <option value="set_var">≔ Variable</option>
                  <option value="mostrar_hotspot">👁 Mostrar HS</option>
                  <option value="ocultar_hotspot">🙈 Ocultar HS</option>
                  <option value="abrir_hotspot">▶ Abrir HS</option>
                </select>
                <template v-if="ef.tipo === 'ir_escena'">
                  <select v-model="ef.escena" @change="ef.punto = 'spawn'" class="effect-field">
                    <option value="">— Escena —</option>
                    <option v-for="sc in tourScenes" :key="sc.id" :value="sc.id">{{ sc.titulo || sc.id }}</option>
                  </select>
                  <select v-if="ef.escena" v-model="ef.punto" class="effect-field">
                    <option value="spawn">Spawn</option>
                    <option v-for="tp in getTeleportPoints(ef.escena)" :key="tp.id" :value="tp.id">{{ tp.etiqueta || tp.id }}</option>
                  </select>
                </template>
                <template v-else-if="ef.tipo === 'set_var'">
                  <input v-model="ef.clave" placeholder="variable" class="effect-field" />
                  <span class="effect-eq">=</span>
                  <input v-model="ef.valor" placeholder="valor" class="effect-field" />
                </template>
                <template v-else-if="ef.tipo === 'mostrar_hotspot' || ef.tipo === 'ocultar_hotspot' || ef.tipo === 'abrir_hotspot'">
                  <select v-model="ef.id" class="effect-field">
                    <option value="">— Hotspot —</option>
                    <option v-for="hs in sceneHotspots" :key="hs.id" :value="hs.id">{{ hs.etiqueta || hs.id }}</option>
                  </select>
                </template>
                <button class="icon-btn danger" @click="op.efectos.splice(ei, 1)">✕</button>
              </div>
              <button class="btn btn-ghost btn-sm" style="align-self:flex-start" @click="op.efectos.push(blankEffect())">+ Acción</button>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="addDecisionOption">+ Opción</button>
        </template>

        <!-- TELEPORT (waypoint en escena) -->
        <template v-else-if="form.tipo === 'teleport'">
          <div class="field-hint">Waypoint invisible. Colócalo en la escena con Modo Editor. Al clic, la cámara va a la posición indicada.</div>
          <div>
            <div class="field-label">Posición destino (x y z)</div>
            <input v-model="form.contenido.posicion" placeholder="0 1.6 -3" />
          </div>
          <div>
            <div class="field-label">Rotación destino (x y z)</div>
            <input v-model="form.contenido.rotacion" placeholder="0 0 0" />
          </div>
          <div>
            <div class="field-label">Etiqueta (solo en editor)</div>
            <input v-model="form.contenido.etiqueta_destino" placeholder="Puerta norte" />
          </div>
        </template>

        <!-- NAVEGACION -->
        <template v-else-if="form.tipo === 'navegacion'">
          <div>
            <div class="field-label">Escena destino</div>
            <select v-model="form.contenido.escena_destino" @change="form.contenido.punto_destino = 'spawn'">
              <option value="">— Elegir escena —</option>
              <option v-for="sc in tourScenes" :key="sc.id" :value="sc.id">
                {{ sc.titulo || sc.id }}
              </option>
            </select>
          </div>
          <div v-if="form.contenido.escena_destino">
            <div class="field-label">Punto de llegada</div>
            <select v-model="form.contenido.punto_destino">
              <option value="spawn">Spawn de la escena</option>
              <option
                v-for="tp in getTeleportPoints(form.contenido.escena_destino)"
                :key="tp.id"
                :value="tp.id"
              >{{ tp.etiqueta || tp.id }}</option>
            </select>
          </div>
          <div>
            <div class="field-label">Ícono (opcional)</div>
            <input v-model="form.contenido.icono" placeholder="→" />
          </div>
        </template>

        <!-- VIDEO -->
        <template v-else-if="form.tipo === 'video'">
          <div>
            <div class="field-label">Título</div>
            <input v-model="form.contenido.titulo" placeholder="Título del video" />
          </div>
          <div>
            <div class="field-label">URL Video</div>
            <input v-model="form.contenido.url" placeholder="assets/video/clip.mp4" />
          </div>
          <div>
            <div class="field-label">Descripción (opcional)</div>
            <textarea v-model="form.contenido.descripcion" rows="2" placeholder="Texto complementario..." />
          </div>
        </template>

        <!-- DIALOGO -->
        <template v-else-if="form.tipo === 'dialogo'">
          <div class="field-hint">Un diálogo es una secuencia de pasos. El usuario avanza con "Siguiente".</div>

          <div v-for="(paso, pi) in form.pasos" :key="pi" class="dialogo-step">
            <div class="dialogo-step-header">
              <span class="dialogo-step-num">Paso {{ pi + 1 }}</span>
              <select :value="paso.tipo" @change="onPasoTypeChange(pi, $event.target.value)" class="paso-type-sel">
                <option value="info">Info</option>
                <option value="trivia">Trivia</option>
                <option value="decision">Decisión</option>
                <option value="video">Video</option>
              </select>
              <button class="icon-btn danger" @click="removePaso(pi)" :disabled="form.pasos.length <= 1">✕</button>
            </div>

            <!-- Paso: info -->
            <template v-if="paso.tipo === 'info'">
              <input v-model="paso.contenido.titulo" placeholder="Título" />
              <textarea v-model="paso.contenido.texto" rows="2" placeholder="Texto..." />
              <input v-model="paso.contenido.imagen" placeholder="Imagen (opcional)" />
            </template>

            <!-- Paso: video -->
            <template v-else-if="paso.tipo === 'video'">
              <input v-model="paso.contenido.titulo" placeholder="Título" />
              <input v-model="paso.contenido.url" placeholder="assets/video/clip.mp4" />
              <textarea v-model="paso.contenido.descripcion" rows="2" placeholder="Descripción..." />
            </template>

            <!-- Paso: trivia -->
            <template v-else-if="paso.tipo === 'trivia'">
              <input v-model="paso.contenido.pregunta" placeholder="Pregunta" />
              <div v-for="(op, oi) in paso.contenido.opciones" :key="oi" class="trivia-option">
                <div class="trivia-row">
                  <input v-model="op.texto" :placeholder="`Opción ${oi + 1}`" style="flex:3" />
                  <label class="trivia-correct">
                    <input type="radio" :name="'pc-'+pi+'-'+form.id" :checked="op.correcta"
                           @change="setPasoOptionCorrect(pi, oi)" />
                    <span>correcta</span>
                  </label>
                  <button class="icon-btn danger" @click="removePasoOption(pi, oi)"
                          :disabled="paso.contenido.opciones.length <= 2">✕</button>
                </div>
                <input v-model="op.retroalimentacion" placeholder="Retroalimentación..." style="margin-top:4px" />
              </div>
              <button class="btn btn-ghost btn-sm" @click="addPasoOption(pi)">+ Opción</button>
            </template>

            <!-- Paso: decision -->
            <template v-else-if="paso.tipo === 'decision'">
              <input v-model="paso.contenido.titulo" placeholder="¿Qué decides?" />
              <textarea v-model="paso.contenido.descripcion" rows="2" placeholder="Contexto..." />
              <div v-for="(op, oi) in paso.contenido.opciones" :key="oi" class="decision-option">
                <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px">
                  <div class="field-label" style="flex:1;margin:0">Opción {{ oi + 1 }}</div>
                  <button class="icon-btn danger" @click="removePasoDecisionOption(pi, oi)"
                          :disabled="paso.contenido.opciones.length <= 2">✕</button>
                </div>
                <input v-model="op.texto" placeholder="Texto visible..." />
                <div class="effects-block">
                  <div class="effects-header">Acciones al elegir esta opción</div>
                  <div v-if="!op.efectos.length" class="effects-empty">Sin acciones — se cierra el panel</div>
                  <div v-for="(ef, ei) in op.efectos" :key="ei" class="effect-row">
                    <select :value="ef.tipo" @change="onEffectTypeChange(op, ei, $event.target.value)" class="effect-type-sel">
                      <option value="ir_escena">→ Ir a escena</option>
                      <option value="set_var">≔ Variable</option>
                      <option value="mostrar_hotspot">👁 Mostrar HS</option>
                      <option value="ocultar_hotspot">🙈 Ocultar HS</option>
                      <option value="abrir_hotspot">▶ Abrir HS</option>
                    </select>
                    <template v-if="ef.tipo === 'ir_escena'">
                      <select v-model="ef.escena" @change="ef.punto = 'spawn'" class="effect-field">
                        <option value="">— Escena —</option>
                        <option v-for="sc in tourScenes" :key="sc.id" :value="sc.id">{{ sc.titulo || sc.id }}</option>
                      </select>
                      <select v-if="ef.escena" v-model="ef.punto" class="effect-field">
                        <option value="spawn">Spawn</option>
                        <option v-for="tp in getTeleportPoints(ef.escena)" :key="tp.id" :value="tp.id">{{ tp.etiqueta || tp.id }}</option>
                      </select>
                    </template>
                    <template v-else-if="ef.tipo === 'set_var'">
                      <input v-model="ef.clave" placeholder="variable" class="effect-field" />
                      <span class="effect-eq">=</span>
                      <input v-model="ef.valor" placeholder="valor" class="effect-field" />
                    </template>
                    <template v-else-if="ef.tipo === 'mostrar_hotspot' || ef.tipo === 'ocultar_hotspot' || ef.tipo === 'abrir_hotspot'">
                      <select v-model="ef.id" class="effect-field">
                        <option value="">— Hotspot —</option>
                        <option v-for="hs in sceneHotspots" :key="hs.id" :value="hs.id">{{ hs.etiqueta || hs.id }}</option>
                      </select>
                    </template>
                    <button class="icon-btn danger" @click="op.efectos.splice(ei, 1)">✕</button>
                  </div>
                  <button class="btn btn-ghost btn-sm" style="align-self:flex-start" @click="op.efectos.push(blankEffect())">+ Acción</button>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" @click="addPasoDecisionOption(pi)">+ Opción</button>
            </template>
          </div>

          <button class="btn btn-ghost btn-sm" @click="form.pasos.push(blankPaso())">+ Añadir paso</button>
        </template>

      </div>

      <div class="divider" />

      <!-- Condición visible -->
      <div class="form-section">
        <div class="field-label">Condición visible <span style="color:#3f3f46;font-weight:400;text-transform:none">(vacío = siempre)</span></div>
        <ConditionInput v-model="form.condicion_visible" />
      </div>

      <div class="hs-form-footer">
        <button class="btn btn-ghost btn-sm" @click="close">Cancelar</button>
        <button class="btn btn-primary btn-sm" @click="save">✓ Guardar hotspot</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ConditionInput from './ConditionInput.vue'
import { useTourStore } from '../stores/tourStore'

const props = defineProps({
  hotspot: { type: Object, default: null },
  visible: { type: Boolean, default: false },
  tourId:  { type: String,  default: null }
})

const store = useTourStore()
const tourScenes = computed(() => store.activeTour?.escenas ?? [])
// Hotspots de la escena activa (excluye el hotspot en edición)
const sceneHotspots = computed(() =>
  store.activeScene?.hotspots?.filter(h => h.id && h.id !== form.value.id) ?? []
)

function getTeleportPoints(escenaId) {
  const scenes = tourScenes.value
  const sc = escenaId ? scenes.find(s => s.id === escenaId) : store.activeScene
  return sc?.hotspots?.filter(h => h.tipo === 'teleport') ?? []
}

const emit = defineEmits(['save', 'close'])

const TYPES = ['info', 'trivia', 'decision', 'teleport', 'navegacion', 'video', 'dialogo']
const editingId = ref(null)
const form = ref(blankForm('info'))

function blankForm(tipo) {
  return {
    id: '',
    tipo,
    etiqueta: '',
    posicion: '0 1.6 -3',
    condicion_visible: null,
    condicion_activo: null,
    contenido: blankContenido(tipo),
    ...(tipo === 'dialogo' ? { pasos: [blankPaso()] } : {})
  }
}

function blankContenido(tipo) {
  switch (tipo) {
    case 'info':       return { titulo: '', texto: '', imagen: '' }
    case 'trivia':     return { pregunta: '', opciones: [blankTriviaOp(), blankTriviaOp()] }
    case 'decision':   return { titulo: '', descripcion: '', opciones: [blankDecisionOp(), blankDecisionOp()] }
    case 'teleport':   return { posicion: '', rotacion: '0 0 0', etiqueta_destino: '' }
    case 'navegacion': return { escena_destino: '', punto_destino: 'spawn', icono: '→' }
    case 'video':      return { titulo: '', url: '', descripcion: '' }
    case 'dialogo':    return {}
    default:           return {}
  }
}

function blankTriviaOp()   { return { texto: '', correcta: false, retroalimentacion: '', puntos: 0 } }
function blankDecisionOp() { return { texto: '', efectos: [] } }
function blankPaso(tipo = 'info') { return { tipo, contenido: blankContenido(tipo) } }

// ── Paso helpers ──────────────────────────────────────────────────────────────
function onPasoTypeChange(pi, tipo) {
  form.value.pasos[pi] = blankPaso(tipo)
}
function removePaso(pi) {
  form.value.pasos.splice(pi, 1)
}
function addPasoOption(pi) {
  form.value.pasos[pi].contenido.opciones.push(blankTriviaOp())
}
function removePasoOption(pi, oi) {
  form.value.pasos[pi].contenido.opciones.splice(oi, 1)
}
function setPasoOptionCorrect(pi, oi) {
  form.value.pasos[pi].contenido.opciones.forEach((o, i) => { o.correcta = i === oi })
}
function addPasoDecisionOption(pi) {
  form.value.pasos[pi].contenido.opciones.push(blankDecisionOp())
}
function removePasoDecisionOption(pi, oi) {
  form.value.pasos[pi].contenido.opciones.splice(oi, 1)
}

function blankEffect(tipo = 'ir_escena') {
  if (tipo === 'ir_escena') return { tipo, escena: '', punto: 'spawn' }
  if (tipo === 'set_var')   return { tipo, clave: '', valor: '' }
  if (tipo === 'mostrar_hotspot' || tipo === 'ocultar_hotspot' || tipo === 'abrir_hotspot')
                            return { tipo, id: '' }
  return { tipo }
}

function onEffectTypeChange(op, idx, tipo) {
  op.efectos.splice(idx, 1, blankEffect(tipo))
}

watch(() => props.hotspot, (hs) => {
  if (!hs) { form.value = blankForm('info'); editingId.value = null; return }

  if (!hs.id && hs.posicion) {
    const base = blankForm('info')
    base.posicion = hs.posicion
    form.value = base
    editingId.value = null
    return
  }

  editingId.value = hs.id
  const clone = JSON.parse(JSON.stringify(hs))

  if (clone.tipo === 'decision' && clone.contenido?.opciones) {
    clone.contenido.opciones = clone.contenido.opciones.map(op => ({
      ...op,
      efectos: op.efectos ?? []
    }))
  }
  if (clone.tipo === 'dialogo') {
    if (!clone.pasos) clone.pasos = [blankPaso()]
    clone.pasos = clone.pasos.map(p => {
      const tipo = p.tipo || 'info'
      const contenido = p.contenido || blankContenido(tipo)
      // Normalizar efectos en opciones de pasos decision
      if (tipo === 'decision' && contenido.opciones) {
        contenido.opciones = contenido.opciones.map(op => ({
          ...op, efectos: op.efectos ?? []
        }))
      }
      return { tipo, contenido }
    })
  }

  form.value = clone
}, { immediate: true })

function changeTipo(t) {
  if (t === form.value.tipo) return
  form.value.tipo = t
  form.value.contenido = blankContenido(t)
  if (t === 'dialogo' && !form.value.pasos?.length) {
    form.value.pasos = [blankPaso()]
  }
}

function setCorrect(idx) {
  form.value.contenido.opciones.forEach((o, i) => { o.correcta = i === idx })
}
function addOption()         { form.value.contenido.opciones.push(blankTriviaOp()) }
function removeOption(idx)   { form.value.contenido.opciones.splice(idx, 1) }
function addDecisionOption() { form.value.contenido.opciones.push(blankDecisionOp()) }
function removeDecisionOption(idx) { form.value.contenido.opciones.splice(idx, 1) }

function save() {
  const out = JSON.parse(JSON.stringify(form.value))
  // Limpiar pasos si no es dialogo
  if (out.tipo !== 'dialogo') delete out.pasos
  emit('save', out)
  window.ptahToast?.('✓ Hotspot guardado')
}

function close() { emit('close') }
</script>

<style scoped>
.hs-form-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.hs-form {
  background: var(--panel-light); border: 1px solid var(--panel-border);
  border-radius: 10px; width: min(640px, 96vw);
  max-height: 90vh; display: flex; flex-direction: column;
  overflow: hidden;
}
.hs-form-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--panel-border);
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #71717a;
  flex-shrink: 0;
}
.form-section {
  padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto;
}
.divider { height: 1px; background: var(--panel-border); flex-shrink: 0; }
.hs-form-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 16px; border-top: 1px solid var(--panel-border); flex-shrink: 0;
}
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field-hint {
  font-size: 10px; color: #52525b; font-style: italic;
  padding: 6px 8px; background: rgba(255,255,255,0.02);
  border-radius: 4px; border: 1px solid var(--panel-border);
}
.icon-btn {
  width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--panel-border);
  background: transparent; color: #71717a; cursor: pointer; font-size: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all 0.1s;
}
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn.danger:hover { border-color: #f87171; color: #f87171; background: rgba(239,68,68,0.1); }

.type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.type-btn {
  padding: 5px; border-radius: 5px; font-size: 10px; font-weight: 600;
  border: 1px solid var(--panel-border); background: var(--panel);
  color: #71717a; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;
  transition: all 0.12s;
}
.type-btn-info.active       { border-color: rgba(34,211,238,0.4); background: rgba(34,211,238,0.1); color: #22d3ee; }
.type-btn-trivia.active     { border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.1); color: #fbbf24; }
.type-btn-decision.active   { border-color: rgba(251,146,60,0.4); background: rgba(251,146,60,0.1); color: #fb923c; }
.type-btn-teleport.active   { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.1); color: #34d399; }
.type-btn-navegacion.active { border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.1); color: #a78bfa; }
.type-btn-video.active      { border-color: rgba(244,114,182,0.4); background: rgba(244,114,182,0.1); color: #f472b6; }
.type-btn-dialogo.active    { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.1); color: #818cf8; }

.trivia-row { display: flex; gap: 6px; align-items: center; }
.trivia-correct { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #71717a; flex-shrink: 0; white-space: nowrap; }
.trivia-correct input { width: auto; }
.trivia-option, .decision-option {
  background: var(--panel); border: 1px solid var(--panel-border);
  border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 5px;
}
.effects-block {
  background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 5px; padding: 8px; display: flex; flex-direction: column; gap: 6px;
  margin-top: 2px;
}
.effects-header { font-size: 9px; font-weight: 600; letter-spacing: 0.07em; color: #52525b; text-transform: uppercase; }
.effects-empty  { font-size: 10px; color: #3f3f46; font-style: italic; }
.effect-row     { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.effect-type-sel {
  flex-shrink: 0; font-size: 10px; padding: 3px 5px;
  background: var(--panel-light); border: 1px solid var(--panel-border);
  color: #a1a1aa; border-radius: 4px; cursor: pointer;
}
.effect-field  { flex: 1; font-size: 10px; padding: 3px 6px; min-width: 0; }
.effect-eq     { color: #52525b; font-size: 11px; flex-shrink: 0; }

/* Diálogo */
.dialogo-step {
  background: var(--panel); border: 1px solid var(--panel-border);
  border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
}
.dialogo-step-header {
  display: flex; align-items: center; gap: 8px;
}
.dialogo-step-num {
  font-size: 10px; font-weight: 600; color: #818cf8;
  letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0;
}
.paso-type-sel {
  flex: 1; font-size: 10px; padding: 3px 6px;
  background: var(--panel-light); border: 1px solid var(--panel-border);
  color: #a1a1aa; border-radius: 4px;
}
</style>
