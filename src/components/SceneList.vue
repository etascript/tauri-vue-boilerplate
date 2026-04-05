<template>
  <div class="scene-list">
    <div class="scene-list-header">
      <span class="field-label" style="margin:0">Escenas ({{ scenes.length }})</span>
      <button class="btn btn-primary btn-sm" @click="$emit('add')">+ Nueva</button>
    </div>

    <div class="scenes">
      <div
        v-for="(scene, idx) in sortedScenes"
        :key="scene.id"
        class="scene-item"
        :class="{
          active: scene.id === activeId,
          initial: scene.id === initialSceneId
        }"
        @click="$emit('select', scene.id)"
      >
        <div class="scene-item-left">
          <div class="scene-idx" :class="{ 'idx-initial': scene.id === initialSceneId }">
            <span v-if="scene.id === initialSceneId">★</span>
            <span v-else>{{ idx + 1 }}</span>
          </div>
          <div class="scene-item-info">
            <div class="scene-item-title">{{ scene.titulo }}</div>
            <div class="scene-item-sub">{{ scene.id }} · {{ scene.hotspots?.length ?? 0 }} hs</div>
          </div>
        </div>
        <div class="scene-item-actions" @click.stop>
          <button
            class="icon-btn star"
            :class="{ 'is-initial': scene.id === initialSceneId }"
            :title="scene.id === initialSceneId ? 'Escena inicial' : 'Establecer como inicial'"
            :disabled="scene.id === initialSceneId"
            @click="$emit('set-initial', scene.id)"
          >★</button>
          <button
            class="icon-btn"
            title="Subir"
            :disabled="isFirst(scene.id)"
            @click="$emit('move', scene.id, -1)"
          >↑</button>
          <button
            class="icon-btn"
            title="Bajar"
            :disabled="isLast(scene.id)"
            @click="$emit('move', scene.id, 1)"
          >↓</button>
          <button class="icon-btn" title="Duplicar" @click="$emit('duplicate', scene.id)">⧉</button>
          <button
            class="icon-btn danger"
            title="Eliminar"
            :disabled="scenes.length <= 1"
            @click="$emit('delete', scene.id)"
          >✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  scenes: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
  initialSceneId: { type: String, default: null }
})
defineEmits(['select', 'add', 'delete', 'duplicate', 'move', 'set-initial'])

// La escena inicial siempre primera, el resto en su orden original
const sortedScenes = computed(() => {
  if (!props.initialSceneId) return props.scenes
  const initial = props.scenes.find(s => s.id === props.initialSceneId)
  const rest = props.scenes.filter(s => s.id !== props.initialSceneId)
  return initial ? [initial, ...rest] : props.scenes
})

function isFirst(sceneId) {
  // La inicial no puede subir; las demás no pueden ir antes de la inicial
  if (sceneId === props.initialSceneId) return true
  const rest = props.scenes.filter(s => s.id !== props.initialSceneId)
  return rest[0]?.id === sceneId
}

function isLast(sceneId) {
  const arr = props.scenes.filter(s => s.id !== props.initialSceneId)
  return arr[arr.length - 1]?.id === sceneId
}
</script>

<style scoped>
.scene-list { display: flex; flex-direction: column; gap: 8px; }

.scene-list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2px;
}

.scenes { display: flex; flex-direction: column; gap: 2px; }

.scene-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 6px;
  border: 1px solid transparent; cursor: pointer;
  transition: all 0.12s; position: relative;
}
.scene-item:hover { background: var(--panel-light); border-color: var(--panel-border); }
.scene-item.active { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.25); }
.scene-item.initial { border-color: rgba(251,191,36,0.2); }
.scene-item.initial:hover { border-color: rgba(251,191,36,0.35); }

.scene-item-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }

.scene-idx {
  width: 22px; height: 22px; border-radius: 4px;
  background: var(--panel-border); color: #a1a1aa;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; flex-shrink: 0;
}
.scene-item.active .scene-idx { background: rgba(52,211,153,0.2); color: var(--accent); }
.scene-idx.idx-initial { background: rgba(251,191,36,0.15); color: #fbbf24; }

.scene-item-info { min-width: 0; }
.scene-item-title { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scene-item-sub { font-size: 10px; color: #52525b; margin-top: 1px; }

.scene-item-left { padding-right: 4px; }
.scene-item-actions {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s;
  background: var(--panel-light); border-radius: 4px; padding: 1px;
}
.scene-item:hover .scene-item-actions { opacity: 1; }

.icon-btn {
  width: 22px; height: 22px; border-radius: 4px; border: none;
  background: transparent; color: #71717a; cursor: pointer;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
  transition: all 0.1s;
}
.icon-btn:hover { background: var(--panel-border); color: #e4e4e7; }
.icon-btn.danger:hover { background: rgba(239,68,68,0.15); color: #f87171; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Star button */
.icon-btn.star { color: #52525b; }
.icon-btn.star:not(:disabled):hover { background: rgba(251,191,36,0.15); color: #fbbf24; }
.icon-btn.star.is-initial { color: #fbbf24; }
.icon-btn.star.is-initial:disabled { opacity: 1; cursor: default; }
</style>
