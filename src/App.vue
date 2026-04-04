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
  <div>
    <nav v-if="!authRoutes.includes(route.name)" class="app-nav">
      <span class="app-nav-brand">TodoTauri</span>
      <div class="app-nav-actions">
        <span class="app-nav-user">
          Hola, <strong>{{ authStore.user?.name }}</strong>
        </span>
        <button class="btn-logout" @click="logout">Cerrar sesión</button>
      </div>
    </nav>

    <main>
      <router-view />
    </main>
  </div>
</template>
