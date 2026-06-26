<template>
  <div
    v-if="mostFrequentPartners?.length || bestPartners?.length || nemeses?.length"
    class="grid grid-cols-1 md:grid-cols-3 lg:md:grid-cols-2 gap-3"
  >
    <div v-if="mostFrequentPartners?.length" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        {{ t('playerRelationStats.frequentPartners') }}
      </div>
      <div
        v-for="p in mostFrequentPartners"
        :key="p.playerId"
        class="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0"
      >
        <RouterLink
          :to="playerLink(p.playerId, tournamentId)"
          class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          <PlayerAvatar :name="p.displayName" size="xs" shape="square" class="shrink-0" />
          <span class="truncate">{{ p.displayName }}</span>
        </RouterLink>
        <span class="text-xs text-gray-500">{{ t('playerRelationStats.matchCount', { count: p.count }) }}</span>
      </div>
    </div>

    <div v-if="bestPartners?.length" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        {{ t('playerRelationStats.bestPartners') }}
      </div>
      <div
        v-for="p in bestPartners"
        :key="p.playerId"
        class="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0"
      >
        <RouterLink
          :to="playerLink(p.playerId, tournamentId)"
          class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          <PlayerAvatar :name="p.displayName" size="xs" shape="square" class="shrink-0" />
          <div class="min-w-0">
            <span class="truncate block">{{ p.displayName }}</span>
          </div>
        </RouterLink>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-gray-500">{{ t('playerRelationStats.matchCount', { count: p.count }) }}</span>
          <div class="text-right">
            <div class="text-xs text-green-400">{{ p.count > 0 ? Math.round((p.wins / p.count) * 100) : 0 }}{{ t('playerRelationStats.winRateSuffix') }}</div>
            <div
              v-if="p.chemistryDelta !== undefined"
              class="text-[10px]"
              :class="p.chemistryDelta > 0 ? 'text-emerald-400' : p.chemistryDelta < 0 ? 'text-red-400' : 'text-gray-500'"
            >{{ p.chemistryDelta > 0 ? '+' : '' }}{{ p.chemistryDelta }}%</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="nemeses?.length" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        {{ t('playerRelationStats.toughOpponents') }}
      </div>
      <div
        v-for="p in nemeses"
        :key="p.playerId"
        class="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0"
      >
        <RouterLink
          :to="playerLink(p.playerId, tournamentId)"
          class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          <PlayerAvatar :name="p.displayName" size="xs" shape="square" class="shrink-0" />
          <span class="truncate">{{ p.displayName }}</span>
        </RouterLink>
        <span class="text-xs text-red-400">{{ t('playerRelationStats.lossCount', { count: p.losses }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PlayerRelationStat } from '@skill-arena/shared/types/index'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { playerLink } from '@/utils/player-link'

defineProps<{
  mostFrequentPartners?: PlayerRelationStat[]
  bestPartners?: PlayerRelationStat[]
  nemeses?: PlayerRelationStat[]
  tournamentId?: string | null
}>()

const { t } = useI18n()
</script>
