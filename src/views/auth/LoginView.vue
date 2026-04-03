<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = ref({ email: '', password: '' })
const error = ref('')
const isLoading = ref(false)

const justRegistered = route.query.registered === '1'

async function handleLogin() {
  error.value = ''
  isLoading.value = true
  try {
    const user = await invoke('login_cmd', { dto: { ...form.value } })
    authStore.setUser(user)
    router.push({ name: 'home' })
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
        <h1 class="text-2xl font-bold text-gray-900">Bienvenido</h1>
        <p class="text-gray-500 text-sm mt-1">Inicia sesión en TodoTauri</p>
      </div>

      <div v-if="justRegistered" class="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
        Cuenta creada correctamente. Ya puedes iniciar sesión.
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
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
          <div class="flex justify-between items-center mb-1">
            <label class="block text-sm font-medium text-gray-700">Contraseña</label>
            <router-link :to="{ name: 'forgot-password' }" class="text-xs text-blue-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </router-link>
          </div>
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
          {{ isLoading ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-500 mt-6">
        ¿No tienes cuenta?
        <router-link :to="{ name: 'register' }" class="text-blue-600 hover:underline font-medium">
          Regístrate
        </router-link>
      </p>

    </div>
  </div>
</template>
