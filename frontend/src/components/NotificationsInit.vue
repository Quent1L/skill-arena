<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useNotificationService } from '@/composables/notification/notification.service'
import { useNotificationSocket } from '@/composables/notification/notification.socket'
import { useAuth } from '@/composables/useAuth'

const { load } = useNotificationService()
const { connect, disconnect } = useNotificationSocket()
const { isAuthenticated } = useAuth()

// Watch authentication status and handle connection/disconnection
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    void load()
    connect()
  } else {
    disconnect()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  disconnect()
})
</script>

<template>
  <slot />
</template>
