<template>
  <div
    v-if="badges.length > 0"
    class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6"
  >
    <div class="flex items-center gap-2 mb-4">
      <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
        <i class="fa fa-medal text-purple-600 dark:text-purple-400 text-sm sm:text-base" />
      </div>
      <div>
        <div class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Badges à débloquer</div>
        <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Récompenses gagnables sur ce tournoi
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="badge in badges"
        :key="badge.ruleId"
        class="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800"
        v-tooltip.top="badge.description"
      >
        <i :class="badge.icon || 'fa fa-medal'" class="text-2xl text-purple-600 shrink-0" />
        <div class="min-w-0">
          <div class="font-semibold text-sm truncate">{{ badge.label }}</div>
          <div class="text-xs text-surface-500 line-clamp-2">{{ badge.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { rulesApi } from '@/composables/rules/rules.api'
import type { AvailableBadge } from '@skill-arena/shared/types/index'

const props = defineProps<{ tournamentId: string }>()

const badges = ref<AvailableBadge[]>([])

async function load(id: string) {
  if (!id) return
  try {
    badges.value = await rulesApi.getAvailableBadges(id)
  } catch {
    badges.value = []
  }
}

watch(() => props.tournamentId, load, { immediate: true })
</script>
