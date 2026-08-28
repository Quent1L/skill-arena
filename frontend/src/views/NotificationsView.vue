<script setup lang="ts">
import NotificationList from '@/components/NotificationList.vue'
import { isBlocking, useNotificationService } from '@/composables/notification/notification.service'
import { useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useAppToast } from '@/composables/useAppToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { load, notifications, markAllAsRead, deleteAll } = useNotificationService()
const router = useRouter()
const toast = useAppToast()

const hasDeletableNotifs = computed(() => notifications.value.some((n) => !isBlocking(n)))
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
    toast.add({ severity: 'success', summary: t('notificationsView.markAllReadSuccess'), life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: t('notificationsView.errorSummary'), detail: t('notificationsView.markAllReadError'), life: 3000 })
  }
}

async function handleDeleteAll() {
  try {
    await deleteAll()
    toast.add({ severity: 'success', summary: t('notificationsView.deleteAllSuccess'), life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: t('notificationsView.errorSummary'), detail: t('notificationsView.deleteAllError'), life: 3000 })
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
          :aria-label="t('notificationsView.backAriaLabel')"
          class="sm:hidden"
        />
        <h2 class="text-lg font-semibold">{{ t('notificationsView.title') }}</h2>
      </div>
      <div v-if="notifications.length > 0" class="flex items-center gap-2">
        <Button text rounded size="small" :disabled="!hasUnreadNotifs" @click="handleMarkAllAsRead" class="flex items-center gap-1.5">
          <i class="fas fa-check-double text-sm"></i>
          <span class="text-xs">{{ t('notificationsView.markAllRead') }}</span>
        </Button>
        <Button text rounded size="small" :disabled="!hasDeletableNotifs" @click="handleDeleteAll" class="flex items-center gap-1.5 text-red-500 hover:text-red-600">
          <i class="fas fa-trash text-sm"></i>
          <span class="text-xs">{{ t('notificationsView.deleteAll') }}</span>
        </Button>
      </div>
    </div>
    <NotificationList />
  </div>
</template>
