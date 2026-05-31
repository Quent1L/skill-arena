<template>
  <div>
    <SplashLoader :visible="!isAppReady" />
    <UpdateOverlay :visible="showUpdateOverlay" />
    <Toast
      position="top-right"
      :breakpoints="{ '640px': { width: 'calc(100vw - 1rem)', right: '0.5rem', left: 'auto' } }"
    />
    <ConfirmDialog />
    <AppWrapper v-if="isAppReady" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppToast } from './composables/useAppToast'
import { useAuth } from './composables/useAuth'
import { useConfigService } from './composables/config/config.service'
import { initErrorService, useErrorService } from './composables/useErrorService'
import { useNotificationService } from './composables/notification/notification.service'
import { useNotificationSocket } from './composables/notification/notification.socket'
import AppWrapper from './AppWrapper.vue'
import SplashLoader from './components/SplashLoader.vue'
import UpdateOverlay from './components/UpdateOverlay.vue'

const { initialize, isAuthenticated } = useAuth()
const { loadConfig } = useConfigService()
const errorService = useErrorService()
const notificationService = useNotificationService()
const notificationSocket = useNotificationSocket()
const toast = useAppToast()

const isAppReady = ref(false)
const showUpdateOverlay = ref(false)

const onUpdateAvailable = () => {
  showUpdateOverlay.value = true
  setTimeout(() => globalThis.location.reload(), 1500)
}

onMounted(async () => {
  globalThis.addEventListener('app:update-available', onUpdateAvailable)

  initErrorService(toast)

  const minDelay = new Promise((resolve) => setTimeout(resolve, 250))

  try {
    await loadConfig()
    console.log('Configuration loaded successfully')
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration:', error)
    errorService.showError(error as Error)
  }

  try {
    await initialize()
  } catch (error: unknown) {
    console.error("Erreur lors de l'initialisation de la session:", error)
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
  globalThis.removeEventListener('app:update-available', onUpdateAvailable)
})
</script>
