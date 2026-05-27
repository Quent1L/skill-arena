<template>
  <div class="rounded-2xl bg-gray-800 p-4">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
      Spécialisation par type de résultat
    </div>
    <div class="space-y-2">
      <div
        v-for="s in stats"
        :key="s.outcomeTypeId"
        class="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0"
      >
        <span class="text-sm text-gray-200">{{ s.outcomeTypeName }}</span>
        <div class="flex items-center gap-2 text-xs shrink-0">
          <span class="text-green-400">{{ s.wins }}V</span>
          <span v-if="s.draws" class="text-gray-400">{{ s.draws }}N</span>
          <span class="text-red-400">{{ s.losses }}D</span>
          <span class="text-gray-500 tabular-nums w-10 text-right">{{ s.winRate }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayerOutcomeTypeStat } from '@skill-arena/shared/types/index'

defineProps<{
  stats: PlayerOutcomeTypeStat[]
}>()
</script>
