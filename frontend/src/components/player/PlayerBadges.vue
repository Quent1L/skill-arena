<template>
  <div v-if="badges.length > 0" class="rounded-2xl p-4">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{{ t('playerBadges.title') }}</div>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
      <div
        v-for="badge in badges"
        :key="badge.id"
        class="flex flex-col items-center text-center p-3 rounded-xl bg-surface-100 dark:bg-surface-800 gap-2 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md"
        @click="openPopover(badge, $event)"
      >
        <i :class="badge.icon || 'fa fa-medal'" class="text-3xl text-purple-600" />
        <div class="font-semibold text-sm leading-tight">{{ badge.label }}</div>
      </div>
    </div>

    <Popover ref="popover">
      <div v-if="selected" class="flex flex-col gap-2 max-w-[220px]">
        <div class="flex items-center gap-2">
          <i :class="selected.icon || 'fa fa-medal'" class="text-xl text-purple-600" />
          <div class="font-semibold text-sm">{{ selected.label }}</div>
        </div>
        <div class="text-xs text-surface-500">{{ selected.description }}</div>
        <div class="text-xs text-purple-500 dark:text-purple-400 font-medium">
          <i class="fa fa-calendar mr-1" />{{ formatDate(selected.awardedAt) }}
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { rulesApi } from '@/composables/rules/rules.api'
import { onWsEvent } from '@/composables/notification/notification.socket'
import type { ClientPlayerBadge } from '@skol-arena/shared/types/index'
import Popover from 'primevue/popover'

const props = defineProps<{ playerId: string }>()

const { t } = useI18n()

const badges = ref<ClientPlayerBadge[]>([])
const popover = ref()
const selected = ref<ClientPlayerBadge | null>(null)

async function load(id: string) {
  if (!id) return
  try {
    badges.value = await rulesApi.getPlayerBadges(id)
  } catch {
    badges.value = []
  }
}

function openPopover(badge: ClientPlayerBadge, event: MouseEvent) {
  selected.value = badge
  popover.value?.toggle(event)
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('fr-FR')
}

watch(() => props.playerId, load, { immediate: true })

const reload = () => load(props.playerId)
const offAwarded = onWsEvent('badge_awarded', reload)
const offRevoked = onWsEvent('badge_revoked', reload)
onUnmounted(() => {
  offAwarded()
  offRevoked()
})
</script>
