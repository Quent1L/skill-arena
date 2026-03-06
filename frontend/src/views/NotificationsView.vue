<script setup lang="ts">
import NotificationList from '@/components/NotificationList.vue'
import { useNotificationService } from '@/composables/notification/notification.service'
import { useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'

const { load, notifications, markAllAsRead, deleteAll } = useNotificationService()
const router = useRouter()
const toast = useToast()

const hasDeletableNotifs = computed(() => notifications.value.some((n) => !n.requiresAction))
const hasUnreadNotifs = computed(() => notifications.value.some((n) => !n.isRead))

onMounted(() => {
  void load()
})

function goBack() {
  router.back()
}

async function handleMarkAllAsRead() {
  try {
    await markAllAsRead()
    toast.add({ severity: 'success', summary: 'Toutes les notifications sont marquées comme lues', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de marquer toutes les notifications comme lues', life: 3000 })
  }
}

async function handleDeleteAll() {
  try {
    await deleteAll()
    toast.add({ severity: 'success', summary: 'Toutes les notifications ont été supprimées', life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de supprimer toutes les notifications', life: 3000 })
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto w-full mt-4">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <Button
          icon="fa fa-arrow-left"
          text
          rounded
          severity="secondary"
          @click="goBack"
          aria-label="Retour"
          class="sm:hidden"
        />
        <h2 class="text-lg font-semibold">Notifications</h2>
      </div>
      <div v-if="notifications.length > 0" class="flex items-center gap-2">
        <Button text rounded size="small" :disabled="!hasUnreadNotifs" @click="handleMarkAllAsRead" class="flex items-center gap-1.5">
          <i class="fas fa-check-double text-sm"></i>
          <span class="text-xs">Tout lire</span>
        </Button>
        <Button text rounded size="small" :disabled="!hasDeletableNotifs" @click="handleDeleteAll" class="flex items-center gap-1.5 text-red-500 hover:text-red-600">
          <i class="fas fa-trash text-sm"></i>
          <span class="text-xs">Tout supprimer</span>
        </Button>
      </div>
    </div>
    <NotificationList />
  </div>
</template>
