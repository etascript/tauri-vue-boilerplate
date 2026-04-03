<script setup>
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const email = ref('')
const error = ref('')
const success = ref(false)
const isLoading = ref(false)

async function handleSubmit() {
  error.value = ''
  isLoading.value = true
  try {
    await invoke('forgot_password_cmd', { dto: { email: email.value } })
    success.value = true
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
        <h1 class="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
        <p class="text-gray-500 text-sm mt-1">Te enviaremos un enlace a tu correo</p>
      </div>

      <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-4 text-sm">
        <p class="font-medium">Correo enviado</p>
        <p class="mt-1">Revisa tu bandeja de entrada. El enlace expira en 2 horas.</p>
      </div>

      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="juan@ejemplo.com"
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
          {{ isLoading ? 'Enviando...' : 'Enviar enlace de recuperación' }}
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
