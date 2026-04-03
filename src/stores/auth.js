import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // Persistencia simple con localStorage
  const user = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))

  const isAuthenticated = computed(() => user.value !== null)

  function setUser(userData) {
    user.value = userData
    localStorage.setItem('auth_user', JSON.stringify(userData))
  }

  function logout() {
    user.value = null
    localStorage.removeItem('auth_user')
  }

  return { user, isAuthenticated, setUser, logout }
})
