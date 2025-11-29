<script setup lang="ts">
import { useNotificationService } from '@/composables/notification/notification.service'
import NotificationItem from './NotificationItem.vue'

const { notifications } = useNotificationService()

const emit = defineEmits<{
  close: []
}>()

function handleNotificationClick() {
  emit('close')
}
</script>

<template>
  <div class="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
    <NotificationItem v-for="n in notifications" :key="n.id" :notif="n" @click="handleNotificationClick" />
    <p v-if="notifications.length === 0" class="text-center text-xs opacity-60 py-4">
      Aucune notification
    </p>
  </div>
</template>
