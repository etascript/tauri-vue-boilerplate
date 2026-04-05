<template>
  <router-view />
  <AppToast />
</template>

<script setup>
import { onMounted } from 'vue'
import { useTourStore } from './stores/tourStore.js'
import AppToast from './components/AppToast.vue'

const store = useTourStore()
onMounted(() => store.init())
</script>
