<template>
  <div>
    <SplashLoader :visible="!isAppReady" />
    <Toast position="top-right" />
    <ConfirmDialog />
    <AppWrapper v-if="isAppReady" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAuth } from './composables/useAuth'
import { useConfigService } from './composables/config/config.service'
import { initErrorService, useErrorService } from './composables/useErrorService'
import { useNotificationService } from './composables/notification/notification.service'
import { useNotificationSocket } from './composables/notification/notification.socket'
import AppWrapper from './AppWrapper.vue'
import SplashLoader from './components/SplashLoader.vue'

const { initialize, isAuthenticated } = useAuth()
const { loadConfig } = useConfigService()
const errorService = useErrorService()
const notificationService = useNotificationService()
const notificationSocket = useNotificationSocket()
const toast = useToast()

const isAppReady = ref(false)

onMounted(async () => {
  initErrorService(toast)

  const minDelay = new Promise((resolve) => setTimeout(resolve, 250))

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
      detail: 'Une erreur inattendue est survenue',
      life: 8000,
    })
  }

  if (isAuthenticated.value) {
    await notificationService.load()
    notificationSocket.connect()
  }

  await minDelay
  isAppReady.value = true
})

onUnmounted(() => {
  errorService.uninstall()
})
</script>
