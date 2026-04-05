<script setup>
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import AuthLayout from '../../components/AuthLayout.vue'

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
  <AuthLayout>
    <div class="auth-card-header">
      <h2 class="title-2">Recuperar contraseña</h2>
      <p class="subtitle">Te enviaremos un código a tu correo</p>
    </div>

    <div v-if="success" class="alert alert-success" style="margin-bottom: var(--space-5);">
      <strong style="display:block;margin-bottom:var(--space-1)">Correo enviado</strong>
      Revisa tu bandeja de entrada. El código expira en 2 horas.
    </div>

    <form v-else class="auth-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="label" for="email">Correo electrónico</label>
        <input
          id="email"
          v-model="email"
          class="input"
          type="email"
          required
          placeholder="tu@correo.com"
          autocomplete="email"
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
        {{ isLoading ? 'Enviando...' : 'Enviar código de recuperación' }}
      </button>
    </form>

    <div class="auth-footer">
      <router-link :to="{ name: 'login' }" class="link">
        ← Volver al inicio de sesión
      </router-link>
    </div>
  </AuthLayout>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
</style>
