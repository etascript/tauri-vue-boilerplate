<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/auth'
import AuthLayout from '../../components/AuthLayout.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = ref({ email: '', password: '' })
const error = ref('')
const isLoading = ref(false)

const justRegistered = route.query.registered === '1'
const justReset = route.query.reset === '1'

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
  <AuthLayout>
    <div class="auth-card-header">
      <h2 class="title-2">Bienvenido de vuelta</h2>
      <p class="subtitle">Inicia sesión para continuar</p>
    </div>

    <div v-if="justRegistered" class="alert alert-success" style="margin-bottom: var(--space-5);">
      Cuenta creada correctamente. Ya puedes iniciar sesión.
    </div>
    <div v-if="justReset" class="alert alert-success" style="margin-bottom: var(--space-5);">
      Contraseña actualizada. Inicia sesión con tu nueva contraseña.
    </div>

    <form class="auth-form" @submit.prevent="handleLogin">
      <div class="form-group">
        <label class="label" for="email">Correo electrónico</label>
        <input
          id="email"
          v-model="form.email"
          class="input"
          type="email"
          required
          placeholder="tu@correo.com"
          autocomplete="email"
        />
      </div>

      <div class="form-group">
        <div class="form-label-row">
          <label class="label" for="password">Contraseña</label>
          <router-link :to="{ name: 'forgot-password' }" class="link caption">
            ¿Olvidaste tu contraseña?
          </router-link>
        </div>
        <input
          id="password"
          v-model="form.password"
          class="input"
          type="password"
          required
          placeholder="••••••••"
          autocomplete="current-password"
        />
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <button type="submit" class="btn btn-primary" :disabled="isLoading">
        <svg v-if="isLoading" style="width:1rem;height:1rem;animation:spin 1s linear infinite" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        {{ isLoading ? 'Iniciando sesión...' : 'Iniciar sesión' }}
      </button>
    </form>

    <div class="auth-footer">
      ¿No tienes cuenta?
      <router-link :to="{ name: 'register' }" class="link">Regístrate</router-link>
    </div>
  </AuthLayout>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
