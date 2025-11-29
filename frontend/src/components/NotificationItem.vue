<template>
  <div :class="classes">
    <div class="flex justify-between items-start gap-2">
      <div class="flex-1 cursor-pointer" @click="handleClick">
        <div class="flex items-center justify-between gap-2 mb-1">
          <h3 class="font-semibold text-sm md:text-base">{{ props.notif.title }}</h3>
          <span class="text-[10px] md:text-xs opacity-60 whitespace-nowrap">
            {{ formatDate(props.notif.createdAt) }}
          </span>
        </div>
        <pre
          class="text-xs md:text-sm opacity-80 whitespace-pre-wrap"
          style="font-family: inherit"
          v-html="props.notif.message"
        ></pre>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span
          v-if="props.notif.requiresAction"
          class="text-[10px] uppercase font-bold text-yellow-700 dark:text-yellow-400"
          >Action</span
        >
        <Button
          v-if="!props.notif.requiresAction"
          @click="handleDelete"
          class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Supprimer la notification"
          text
          rounded
          size="small"
        >
          <i class="fas fa-times text-sm"></i>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Notification } from '@/composables/notification/notification.service'
import { useNotificationService } from '@/composables/notification/notification.service'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'

const props = defineProps<{ notif: Notification }>()
const { open, deleteNotification } = useNotificationService()
const router = useRouter()
const toast = useToast()

const emit = defineEmits<{
  click: []
}>()

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`
  
  // Format complet pour les notifications plus anciennes
  return date.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleClick() {
  emit('click')
  open(props.notif, router)
}

async function handleDelete(event: Event) {
  event.stopPropagation()
  try {
    await deleteNotification(props.notif.id)
    toast.add({
      severity: 'success',
      summary: 'Notification supprimée',
      life: 2000,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la suppression'
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: message,
      life: 3000,
    })
  }
}

const classes = computed(() => {
  return [
    'p-3 rounded-lg border cursor-pointer select-none transition',
    props.notif.isRead
      ? 'bg-white border-gray-300 dark:bg-gray-800'
      : 'bg-blue-50 border-blue-400 dark:bg-blue-900/40',
    props.notif.requiresAction ? 'border-yellow-500' : '',
  ].join(' ')
})
</script>
