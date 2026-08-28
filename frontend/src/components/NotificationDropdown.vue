<script setup lang="ts">
import NotificationList from './NotificationList.vue'
import { useTemplateRef, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isBlocking, useNotificationService } from '@/composables/notification/notification.service'
import { useAppToast } from '@/composables/useAppToast'

const { t } = useI18n()

const popover = useTemplateRef('popover')
const router = useRouter()
const { notifications, markAllAsRead, deleteAll } = useNotificationService()
const toast = useAppToast()

const hasNotifications = computed(() => notifications.value.length > 0)
const hasDeletableNotifs = computed(() => notifications.value.some((n) => !isBlocking(n)))
const hasUnreadNotifs = computed(() => notifications.value.some((n) => !n.isRead))

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
      summary: t('notificationDropdown.toast.markAllSuccess'),
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('notificationDropdown.toast.error'),
      detail: t('notificationDropdown.toast.markAllError'),
      life: 3000,
    })
  }
}

async function handleDeleteAll() {
  try {
    await deleteAll()
    toast.add({
      severity: 'success',
      summary: t('notificationDropdown.toast.deleteAllSuccess'),
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('notificationDropdown.toast.error'),
      detail: t('notificationDropdown.toast.deleteAllError'),
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
        <h3 class="font-semibold">{{ t('notificationDropdown.title') }}</h3>
        <div v-if="hasNotifications" class="flex items-center gap-1">
          <span
            v-tooltip.bottom="hasUnreadNotifs ? t('notificationDropdown.markAllAsRead') : t('notificationDropdown.allAlreadyRead')"
            class="inline-flex"
          >
            <Button
              text
              rounded
              size="small"
              :disabled="!hasUnreadNotifs"
              @click="handleMarkAllAsRead"
              style="pointer-events: auto"
            >
              <i class="fas fa-check-double text-sm"></i>
            </Button>
          </span>
          <span
            v-tooltip.bottom="hasDeletableNotifs ? t('notificationDropdown.deleteAll') : t('notificationDropdown.actionNotifsCantDelete')"
            class="inline-flex"
          >
            <Button
              text
              rounded
              size="small"
              :disabled="!hasDeletableNotifs"
              @click="handleDeleteAll"
              class="text-red-500 hover:text-red-600"
              style="pointer-events: auto"
            >
              <i class="fas fa-trash text-sm"></i>
            </Button>
          </span>
          <Button text size="small" :label="t('notificationDropdown.viewAll')" @click="viewAll" />
        </div>
      </div>
      <NotificationList :constrained="true" @close="close" />
    </div>
  </Popover>
</template>
