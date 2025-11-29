<script setup lang="ts">
import NotificationList from './NotificationList.vue'
import { useTemplateRef, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationService } from '@/composables/notification/notification.service'
import { useToast } from 'primevue/usetoast'

const popover = useTemplateRef('popover')
const router = useRouter()
const { notifications, markAllAsRead, deleteAll } = useNotificationService()
const toast = useToast()

const hasNotifications = computed(() => notifications.value.length > 0)

function toggle(event: Event) {
  popover.value?.toggle(event)
}

function close() {
  popover.value?.hide()
}

function viewAll() {
  close()
  router.push('/notifications')
}

async function handleMarkAllAsRead() {
  try {
    await markAllAsRead()
    toast.add({
      severity: 'success',
      summary: 'Toutes les notifications sont marquées comme lues',
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de marquer toutes les notifications comme lues',
      life: 3000,
    })
  }
}

async function handleDeleteAll() {
  try {
    await deleteAll()
    toast.add({
      severity: 'success',
      summary: 'Toutes les notifications ont été supprimées',
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de supprimer toutes les notifications',
      life: 3000,
    })
  }
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popover" :dismissable="true">
    <div class="w-[90vw] sm:w-96">
      <div class="flex justify-between items-center pb-3 border-b">
        <h3 class="font-semibold">Notifications</h3>
        <div v-if="hasNotifications" class="flex items-center gap-1">
          <Button 
            text 
            rounded 
            size="small" 
            @click="handleMarkAllAsRead"
            v-tooltip.bottom="'Tout marquer comme lu'"
          >
            <i class="fas fa-check text-sm"></i>
          </Button>
          <Button 
            text 
            rounded 
            size="small" 
            @click="handleDeleteAll"
            v-tooltip.bottom="'Tout supprimer'"
            class="text-red-500 hover:text-red-600"
          >
            <i class="fas fa-trash text-sm"></i>
          </Button>
          <Button text size="small" label="Tout voir" @click="viewAll" />
        </div>
      </div>
      <NotificationList @close="close" />
    </div>
  </Popover>
</template>
