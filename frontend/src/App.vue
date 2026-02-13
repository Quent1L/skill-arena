<template>
  <div>
    <Toast position="top-right" />
    <ConfirmDialog />
    <AppWrapper />
  </div>
</template>

<script setup lang="ts">
import {  onMounted, onUnmounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuth } from './composables/useAuth'
import { useConfigService } from './composables/config/config.service'
import { initErrorService, useErrorService } from './composables/useErrorService'
import AppWrapper from './AppWrapper.vue'

const { initialize } = useAuth()
const { loadConfig } = useConfigService()
const errorService = useErrorService()
const toast = useToast()

onMounted(async () => {
  initErrorService(toast)

  try {
    await loadConfig()
    console.log('✅ Configuration loaded successfully')
  } catch (error) {
    console.error('❌ Erreur lors du chargement de la configuration:', error)
    errorService.showError(error as Error)
  }

  try {
    await initialize()
  } catch (error: unknown) {
    console.error("❌ Erreur lors de l'initialisation de la session:", error)

      toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail:  'Une erreur inattendue est survenue',
        life: 8000,
      })

  }
})
onUnmounted(() => {
  errorService.uninstall()
})
</script>
