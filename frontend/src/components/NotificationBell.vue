<script setup lang="ts">
import { useNotificationService } from '@/composables/notification/notification.service'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { t } = useI18n()
const { unreadCount } = useNotificationService()
const router = useRouter()

const emit = defineEmits<{
  toggle: [event: Event]
}>()

const isMobile = computed(() => window.innerWidth < 640)

function handleClick(event: Event) {
  if (isMobile.value) {
    router.push('/notifications')
  } else {
    emit('toggle', event)
  }
}
</script>

<template>
  <Button :aria-label="t('notificationBell.ariaLabel')" text @click="handleClick">
    <OverlayBadge v-if="unreadCount > 0" :value="unreadCount" severity="danger" size="small">
      <span class="fa fa-bell text-color" style="font-size: 1.3rem" />
    </OverlayBadge>
    <span v-else class="fa fa-bell text-color" style="font-size: 1.3rem"> </span>
  </Button>
</template>
