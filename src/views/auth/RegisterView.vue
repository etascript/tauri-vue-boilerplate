<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import AuthLayout from '../../components/AuthLayout.vue'

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
  <AuthLayout>
    <div class="auth-card-header">
      <h2 class="title-2">Crear cuenta</h2>
      <p class="subtitle">Únete a TodoTauri hoy</p>
    </div>

    <form class="auth-form" @submit.prevent="handleRegister">
      <div class="form-row">
        <div class="form-group">
          <label class="label" for="name">Nombre</label>
          <input
            id="name"
            v-model="form.name"
            class="input"
            type="text"
            required
            placeholder="Juan"
            autocomplete="given-name"
          />
        </div>
        <div class="form-group">
          <label class="label" for="lastname">Apellido</label>
          <input
            id="lastname"
            v-model="form.lastname"
            class="input"
            type="text"
            required
            placeholder="Pérez"
            autocomplete="family-name"
          />
        </div>
      </div>

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
        <label class="label" for="password">Contraseña</label>
        <input
          id="password"
          v-model="form.password"
          class="input"
          type="password"
          required
          placeholder="••••••••"
          autocomplete="new-password"
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
        {{ isLoading ? 'Creando cuenta...' : 'Crear cuenta' }}
      </button>
    </form>

    <div class="auth-footer">
      ¿Ya tienes cuenta?
      <router-link :to="{ name: 'login' }" class="link">Inicia sesión</router-link>
    </div>
  </AuthLayout>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
