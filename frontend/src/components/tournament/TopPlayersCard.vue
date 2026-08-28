<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
    <h2
      class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-4 min-w-0"
    >
      <i :class="[icon, iconClass]" />
      <span class="truncate">{{ title }}</span>
      <LowSampleBadge v-if="isLowSample" />
      <InfoTooltip :text="tooltip" />
    </h2>
    <div>
      <StatLeaderRow
        v-for="(item, i) in items"
        :key="item.id"
        :players="item.players"
        :rank="item.rank"
        :tied-count="item.tiedCount"
        :show-tie="startsTiedGroup(i)"
        :tie-label="t('common.exAequo')"
        :tie-tooltip="t('common.exAequoTooltip', { count: item.tiedCount })"
        :value="`${item.winRate} %`"
        :value-class="winRateClass(item.winRate)"
        :sub-label="item.subLabel"
        :bar-pct="barWidth(item)"
        :bar-class="barClass"
        :tournament-id="tournamentId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CompetitionRank } from '@skol-arena/shared/types/index'
import InfoTooltip from '@/components/InfoTooltip.vue'
import LowSampleBadge from '@/components/stats/LowSampleBadge.vue'
import StatLeaderRow, { type StatLeaderPlayer } from '@/components/stats/StatLeaderRow.vue'

export interface TopPlayerItem extends CompetitionRank {
  id: string
  /** One player, or the whole roster for a team row. */
  players: StatLeaderPlayer[]
  winRate: number
  /** Win rate weighted by sample size — the value the ranking is actually sorted on. */
  score: number
  subLabel: string
}

const props = defineProps<{
  title: string
  icon: string
  iconClass: string
  /** Explains what the card ranks on, since the headline figure is the raw rate. */
  tooltip: string
  barClass: string
  items: TopPlayerItem[]
  isLowSample?: boolean
  tournamentId?: string | null
}>()

const { t } = useI18n()

/**
 * The bar tracks the weighted score, not the percentage next to it: the ranking is
 * decided on the former, and a bar that grew as the reader went down the list would
 * make the order look wrong.
 */
function barWidth(item: TopPlayerItem): number {
  const best = props.items[0]?.score ?? 0
  if (best <= 0) return 0
  return Math.round((item.score / best) * 100)
}

/** The tie marker belongs to the group, not to each of its rows. */
function startsTiedGroup(index: number): boolean {
  const item = props.items[index]
  if (!item || item.tiedCount < 2) return false
  return props.items[index - 1]?.rank !== item.rank
}

function winRateClass(rate: number) {
  if (rate >= 60) return 'text-green-600 dark:text-green-400'
  if (rate >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}
</script>
