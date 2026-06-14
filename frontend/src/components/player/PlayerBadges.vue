<template>
  <div v-if="badges.length > 0" class="rounded-2xl p-4">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Badges</div>
    <div class="flex flex-wrap gap-3">
      <div
        v-for="badge in badges"
        :key="badge.id"
        class="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800"
        v-tooltip.top="formatDate(badge.awardedAt)"
      >
        <i :class="badge.icon || 'fa fa-medal'" class="text-2xl text-purple-600"></i>
        <div>
          <div class="font-semibold text-sm">{{ badge.label }}</div>
          <div class="text-xs text-surface-500">{{ badge.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { rulesApi } from '@/composables/rules/rules.api'
import type { ClientPlayerBadge } from '@skill-arena/shared/types/index'

const props = defineProps<{ playerId: string }>()

const badges = ref<ClientPlayerBadge[]>([])

async function load(id: string) {
  if (!id) return
  try {
    badges.value = await rulesApi.getPlayerBadges(id)
  } catch {
    badges.value = []
  }
}

function formatDate(date: Date) {
  return `Obtenu le ${new Date(date).toLocaleDateString('fr-FR')}`
}

watch(() => props.playerId, load, { immediate: true })
</script>
