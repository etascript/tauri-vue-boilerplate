<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()
const route = useRoute()

const form = ref({ token: '', new_password: '', confirm_password: '' })
const error = ref('')
const success = ref(false)
const isLoading = ref(false)

onMounted(() => {
  // Pre-rellena el token si viene en la URL (?token=...)
  if (route.query.token) {
    form.value.token = route.query.token
  }
})

async function handleReset() {
  error.value = ''

  if (form.value.new_password !== form.value.confirm_password) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  isLoading.value = true
  try {
    await invoke('reset_password_cmd', {
      dto: { token: form.value.token, new_password: form.value.new_password }
    })
    success.value = true
    setTimeout(() => router.push({ name: 'login' }), 2500)
  } catch (e) {
    error.value = e
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-md w-full max-w-md p-8">

      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
        <p class="text-gray-500 text-sm mt-1">Ingresa el código recibido y tu nueva contraseña</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-4 text-sm">
        <p class="font-medium">Contraseña actualizada</p>
        <p class="mt-1">Redirigiendo al inicio de sesión...</p>
      </div>

      <form v-else @submit.prevent="handleReset" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Código de recuperación</label>
          <input
            v-model="form.token"
            type="text"
            required
            placeholder="Pega aquí el código del correo"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input
            v-model="form.new_password"
            type="password"
            required
            placeholder="••••••••"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input
            v-model="form.confirm_password"
            type="password"
            required
            placeholder="••••••••"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {{ isLoading ? 'Guardando...' : 'Guardar nueva contraseña' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-500 mt-6">
        <router-link :to="{ name: 'login' }" class="text-blue-600 hover:underline font-medium">
          Volver al inicio de sesión
        </router-link>
      </p>

    </div>
  </div>
</template>
