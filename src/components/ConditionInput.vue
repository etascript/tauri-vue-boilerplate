<template>
  <div class="cond-row">
    <input v-model="clave" placeholder="variable" style="flex:2" @change="emit_" />
    <select v-model="op" style="flex:1" @change="emit_">
      <option v-for="o in ops" :key="o">{{ o }}</option>
    </select>
    <input v-model="valor" placeholder="valor" style="flex:1.5" @input="emit_" />
    <button class="clear-btn" title="Limpiar" @click="clear">✕</button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ modelValue: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])

const ops = ['==', '!=', '>', '>=', '<', '<=', 'includes', '!includes']
const clave = ref('')
const op = ref('==')
const valor = ref('')

watch(() => props.modelValue, (v) => {
  clave.value = v?.clave ?? ''
  op.value = v?.operador ?? '=='
  valor.value = v?.valor != null ? String(v.valor) : ''
}, { immediate: true })

function parseVal(v) {
  if (v === 'true') return true
  if (v === 'false') return false
  if (!isNaN(v) && v !== '') return Number(v)
  return v
}

function emit_() {
  emit('update:modelValue', clave.value.trim()
    ? { clave: clave.value.trim(), operador: op.value, valor: parseVal(valor.value.trim()) }
    : null
  )
}

function clear() {
  clave.value = ''; op.value = '=='; valor.value = ''
  emit('update:modelValue', null)
}
</script>

<style scoped>
.cond-row { display: flex; gap: 5px; align-items: center; }
.clear-btn {
  width: 26px; height: 26px; border-radius: 4px; border: 1px solid var(--panel-border);
  background: transparent; color: #52525b; cursor: pointer; flex-shrink: 0;
  font-size: 10px; transition: all 0.12s;
}
.clear-btn:hover { border-color: #f87171; color: #f87171; }
</style>
