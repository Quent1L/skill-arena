<script setup lang="ts">
import NotificationList from '@/components/NotificationList.vue'
import { useNotificationService } from '@/composables/notification/notification.service'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'

const { load } = useNotificationService()
const router = useRouter()

onMounted(() => {
  void load()
})

function goBack() {
  router.back()
}
</script>

<template>
  <div class="max-w-xl mx-auto w-full mt-4">
    <div class="flex items-center gap-3 mb-4">
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
    <NotificationList />
  </div>
</template>
