<template>
  <div class="home">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">⬡</span>
        <span class="logo-name">Ptah<span class="logo-accent">360</span></span>
        <span class="logo-sub">Studio</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="handleImport">
          ↑ Importar JSON
        </button>
        <button class="btn btn-primary" @click="handleCreate">
          + Nuevo Tour
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="content">
      <div v-if="loading" class="empty">
        <div class="empty-icon">⬡</div>
        <p>Cargando proyectos…</p>
      </div>

      <div v-else-if="store.projects.length === 0" class="empty">
        <div class="empty-icon">⬡</div>
        <h2>Sin proyectos</h2>
        <p>Crea tu primera experiencia 360°</p>
        <button class="btn btn-primary" @click="handleCreate">+ Nuevo Tour</button>
      </div>

      <div v-else class="tour-grid">
        <div
          v-for="project in store.projects"
          :key="project.id"
          class="tour-card"
        >
          <div class="tour-card-top">
            <div class="tour-thumb">
              <span>{{ project.titulo?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <div class="tour-meta">
              <div class="tour-title">{{ project.titulo }}</div>
              <div class="tour-info">
                {{ project.scene_count }} escena{{ project.scene_count !== 1 ? 's' : '' }}
                · v{{ project.version }}
              </div>
              <div class="tour-date">{{ formatDate(project.updated_at) }}</div>
            </div>
          </div>

          <div class="tour-card-actions">
            <button class="btn btn-primary btn-sm" @click="openEditor(project.id)">
              ✎ Editar
            </button>
            <button class="btn btn-danger btn-sm" @click="handleDelete(project.id, project.titulo)">
              ✕
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Import modal -->
    <div v-if="showImportModal" class="modal-bg" @click.self="showImportModal = false">
      <div class="modal">
        <h3>Importar tour.json</h3>
        <textarea v-model="importJson" placeholder='Pega el contenido del tour.json aquí...' rows="10" />
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showImportModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="confirmImport">Importar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTourStore } from '../stores/tourStore.js'

const store = useTourStore()
const router = useRouter()

const loading = ref(true)
const showImportModal = ref(false)
const importJson = ref('')

onMounted(async () => {
  await store.init()
  loading.value = false
})

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

async function handleCreate() {
  const tour = await store.createTour('Nuevo Tour')
  openEditor(tour.id)
}

function openEditor(id) {
  router.push(`/editor/${id}`)
}

async function handleDelete(id, titulo) {
  if (!confirm(`¿Eliminar "${titulo}"? Esta acción no se puede deshacer.`)) return
  await store.deleteTour(id)
  window.ptahToast?.('Proyecto eliminado')
}

function handleImport() {
  importJson.value = ''
  showImportModal.value = true
}

async function confirmImport() {
  const tour = await store.importTour(importJson.value)
  if (!tour) { window.ptahToast?.('⚠ JSON inválido'); return }
  showImportModal.value = false
  window.ptahToast?.('✓ Tour importado')
  openEditor(tour.id)
}
</script>

<style scoped>
.home { height: 100vh; display: flex; flex-direction: column; }

.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel); flex-shrink: 0;
}

.logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 22px; color: var(--accent); }
.logo-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
.logo-accent { color: var(--accent); }
.logo-sub { font-size: 11px; color: #52525b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

.header-actions { display: flex; gap: 8px; }

.content { flex: 1; overflow-y: auto; padding: 32px; }

.empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100%; gap: 12px;
  color: #52525b; text-align: center;
}
.empty-icon { font-size: 48px; opacity: 0.3; margin-bottom: 8px; }
.empty h2 { font-size: 20px; color: #71717a; }
.empty p { font-size: 13px; margin-bottom: 16px; }

.tour-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.tour-card {
  background: var(--panel); border: 1px solid var(--panel-border);
  border-radius: 10px; padding: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tour-card:hover { border-color: #52525b; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }

.tour-card-top { display: flex; gap: 12px; margin-bottom: 14px; }

.tour-thumb {
  width: 48px; height: 48px; border-radius: 8px;
  background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: var(--accent); flex-shrink: 0;
}

.tour-meta { flex: 1; min-width: 0; }
.tour-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tour-info { font-size: 11px; color: #71717a; margin-top: 3px; }
.tour-date { font-size: 10px; color: #52525b; margin-top: 2px; }

.tour-card-actions { display: flex; gap: 6px; }

/* Modal */
.modal-bg {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--panel-light); border: 1px solid var(--panel-border);
  border-radius: 10px; padding: 24px; width: 520px; max-width: 90vw;
  display: flex; flex-direction: column; gap: 16px;
}
.modal h3 { font-size: 14px; font-weight: 600; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
