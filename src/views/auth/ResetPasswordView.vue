<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import AuthLayout from '../../components/AuthLayout.vue'

const router = useRouter()
const route = useRoute()

const form = ref({ token: '', new_password: '', confirm_password: '' })
const error = ref('')
const success = ref(false)
const isLoading = ref(false)

onMounted(() => {
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
    setTimeout(() => router.push({ name: 'login', query: { reset: '1' } }), 2500)
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
      <h2 class="title-2">Nueva contraseña</h2>
      <p class="subtitle">Ingresa el código recibido y tu nueva contraseña</p>
    </div>

    <div v-if="success" class="alert alert-success" style="margin-bottom: var(--space-5);">
      <strong style="display:block;margin-bottom:var(--space-1)">Contraseña actualizada</strong>
      Redirigiendo al inicio de sesión...
    </div>

    <form v-else class="auth-form" @submit.prevent="handleReset">
      <div class="form-group">
        <label class="label" for="token">Código de recuperación</label>
        <input
          id="token"
          v-model="form.token"
          class="input input-mono"
          type="text"
          required
          placeholder="Pega aquí el código del correo"
        />
      </div>

      <div class="form-group">
        <label class="label" for="new_password">Nueva contraseña</label>
        <input
          id="new_password"
          v-model="form.new_password"
          class="input"
          type="password"
          required
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </div>

      <div class="form-group">
        <label class="label" for="confirm_password">Confirmar contraseña</label>
        <input
          id="confirm_password"
          v-model="form.confirm_password"
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
        {{ isLoading ? 'Guardando...' : 'Guardar nueva contraseña' }}
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
