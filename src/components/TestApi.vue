<script setup lang="ts">
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

// Variables reactivas para nuestro formulario
const email = ref('');
const password = ref('');

// Variables para mostrar la respuesta (como en Postman)
const responseData = ref<any>(null);
const responseError = ref<string | null>(null);
const isLoading = ref(false);

// Función que llama a nuestro backend en Rust
const testRegister = async () => {
  isLoading.value = true;
  responseData.value = null;
  responseError.value = null;

  try {
    // Importante: El nombre 'register_cmd' debe coincidir EXACTAMENTE
    // con el nombre de la función en tu archivo auth_cmd.rs
    const res = await invoke('register_cmd', { 
      dto: { 
        name: "Test",
        lastname: "User",
        email: email.value, 
        password: password.value 
      } 
    });
    
    // Si Rust responde con Ok(UserResponseDto), caerá aquí
    responseData.value = res;
  } catch (err: any) {
    // Si Rust responde con Err(String), caerá aquí
    responseError.value = err;
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4 border border-gray-200 mt-10">
    <h2 class="text-2xl font-bold text-gray-800 border-b pb-2">Tauri API Tester 🧪</h2>
    
    <div class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700">Email</label>
        <input 
          v-model="email" 
          type="email" 
          placeholder="ejemplo@correo.com"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700">Password</label>
        <input 
          v-model="password" 
          type="password" 
          placeholder="********"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <button 
        @click="testRegister" 
        :disabled="isLoading"
        class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
      >
        {{ isLoading ? 'Enviando...' : 'Probar register_cmd' }}
      </button>
    </div>

    <div class="mt-6">
      <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Respuesta del Backend</h3>
      
      <div v-if="responseData" class="bg-green-50 p-3 rounded border border-green-200 text-sm overflow-auto">
        <span class="font-bold text-green-700">✅ Éxito (200 OK):</span>
        <pre class="mt-2 text-green-900">{{ responseData }}</pre>
      </div>

      <div v-else-if="responseError" class="bg-red-50 p-3 rounded border border-red-200 text-sm overflow-auto">
        <span class="font-bold text-red-700">❌ Error:</span>
        <pre class="mt-2 text-red-900">{{ responseError }}</pre>
      </div>

      <div v-else class="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-400 text-center italic">
        Esperando petición...
      </div>
    </div>
  </div>
</template>