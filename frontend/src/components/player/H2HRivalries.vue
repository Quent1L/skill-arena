<template>
  <div class="rounded-2xl bg-gray-800 p-4">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center">
      Rivalités
      <i
        v-if="tooltip"
        v-tooltip.top="tooltip"
        class="ml-1 fas fa-circle-info text-[10px] text-gray-600 cursor-help shrink-0"
      />
    </div>
    <div class="space-y-1.5">
      <div
        v-for="h in stats"
        :key="h.opponentId"
        class="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0"
      >
        <RouterLink
          :to="playerLink(h.opponentId, tournamentId)"
          class="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 min-w-0"
        >
          <span class="truncate">{{ h.displayName }}</span>
        </RouterLink>
        <div class="flex items-center gap-2 text-xs shrink-0">
          <span class="text-green-400">{{ h.wins }}V</span>
          <span v-if="h.draws" class="text-gray-400">{{ h.draws }}N</span>
          <span class="text-red-400">{{ h.losses }}D</span>
          <span
            class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
            :class="
              h.winRate > 55
                ? 'bg-green-800/60 text-green-300'
                : h.winRate < 45
                  ? 'bg-red-800/60 text-red-300'
                  : 'bg-gray-700 text-gray-400'
            "
            >{{ h.winRate }}%</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { PlayerH2HStat } from '@skill-arena/shared/types/index'
import { playerLink } from '@/utils/player-link'

defineProps<{
  stats: PlayerH2HStat[]
  tooltip?: string
  tournamentId?: string
}>()
</script>
