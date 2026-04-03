<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const authRoutes = ['login', 'register', 'forgot-password', 'reset-password']

function logout() {
  authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- Nav solo visible en rutas privadas -->
    <nav
      v-if="!authRoutes.includes(route.name)"
      class="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center"
    >
      <div class="font-bold text-xl text-blue-600">TodoTauri</div>

      <div class="flex items-center space-x-4">
        <span class="text-sm text-gray-500">
          Hola, <span class="font-medium text-gray-700">{{ authStore.user?.name }}</span>
        </span>
        <button
          @click="logout"
          class="text-sm text-gray-600 hover:text-red-600 font-medium px-3 py-2 rounded-md transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>

    <main class="container mx-auto p-4">
      <router-view />
    </main>

  </div>
</template>
