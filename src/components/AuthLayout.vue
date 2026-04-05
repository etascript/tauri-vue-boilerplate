<script setup>
defineProps({
  // Ruta de la imagen de fondo. Ej: '/bg-auth.jpg'
  // Si no se pasa, se usa el gradiente definido en .auth-layout
  backgroundImage: {
    type: String,
    default: null,
  },
})
</script>

<template>
  <div
    class="auth-layout"
    :class="{ 'auth-layout-image': backgroundImage }"
    :style="backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}"
  >
    <!-- Logo sobre el card -->
    <div style="position: absolute; top: 0; left: 0; right: 0; z-index: 10; padding: 2rem; display: flex; justify-content: center;">
      <div class="auth-logo">Todo<span>Tauri</span></div>
    </div>

    <!-- Glass card -->
    <div class="auth-card glass-card">
      <slot />
    </div>
  </div>
</template>
