<template>
  <div class="hs-list">
    <div class="hs-list-header">
      <span class="field-label" style="margin:0">Hotspots ({{ hotspots.length }})</span>
      <button class="btn btn-primary btn-sm" @click="$emit('add')">+ Nuevo</button>
    </div>

    <div v-if="!hotspots.length" class="hs-empty">
      Sin hotspots en esta escena
    </div>

    <div v-else class="hs-items">
      <div
        v-for="hs in hotspots" :key="hs.id"
        class="hs-item"
        :class="{ active: hs.id === activeId }"
        @click="$emit('edit', hs)"
      >
        <div class="hs-item-left">
          <span :class="['badge', 'badge-' + hs.tipo]">{{ hs.tipo }}</span>
          <div class="hs-item-info">
            <div class="hs-item-label">{{ hs.etiqueta || hs.id }}</div>
            <div class="hs-item-pos">{{ hs.posicion }}</div>
          </div>
        </div>
        <button class="icon-btn danger" @click.stop="$emit('delete', hs.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  hotspots: { type: Array, default: () => [] },
  activeId: { type: String, default: null }
})
defineEmits(['add', 'edit', 'delete'])
</script>

<style scoped>
.hs-list { display: flex; flex-direction: column; gap: 8px; }
.hs-list-header { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; }
.hs-empty { text-align: center; padding: 20px; font-size: 11px; color: #52525b; }
.hs-items { display: flex; flex-direction: column; gap: 2px; }

.hs-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.12s;
}
.hs-item:hover { background: var(--panel-light); border-color: var(--panel-border); }
.hs-item.active { background: rgba(52,211,153,0.07); border-color: rgba(52,211,153,0.2); }

.hs-item-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.hs-item-info { min-width: 0; }
.hs-item-label { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hs-item-pos { font-size: 10px; color: #52525b; font-family: monospace; }

.icon-btn {
  width: 22px; height: 22px; border-radius: 4px; border: none;
  background: transparent; color: #52525b; cursor: pointer; font-size: 10px;
  display: flex; align-items: center; justify-content: center; opacity: 0; transition: all 0.1s;
}
.hs-item:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: rgba(239,68,68,0.15); color: #f87171; }
</style>
