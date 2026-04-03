<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'

const router = useRouter()

const form = ref({ name: '', lastname: '', email: '', password: '' })
const error = ref('')
const isLoading = ref(false)

async function handleRegister() {
  error.value = ''
  isLoading.value = true
  try {
    await invoke('register_cmd', { dto: { ...form.value } })
    router.push({ name: 'login', query: { registered: '1' } })
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
        <h1 class="text-2xl font-bold text-gray-900">Crear cuenta</h1>
        <p class="text-gray-500 text-sm mt-1">Únete a TodoTauri</p>
      </div>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="Juan"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
            <input
              v-model="form.lastname"
              type="text"
              required
              placeholder="Pérez"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            v-model="form.email"
            type="email"
            required
            placeholder="juan@ejemplo.com"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input
            v-model="form.password"
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
          {{ isLoading ? 'Creando cuenta...' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-500 mt-6">
        ¿Ya tienes cuenta?
        <router-link :to="{ name: 'login' }" class="text-blue-600 hover:underline font-medium">
          Inicia sesión
        </router-link>
      </p>

    </div>
  </div>
</template>
