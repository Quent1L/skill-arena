<template>
  <div>
    <div
      class="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2"
    >
      <i :class="icon" />
      {{ title }}

      <span
        v-if="board.isLowSample"
        class="inline-flex items-center gap-1 text-[10px] leading-none text-amber-400/80 min-w-0"
        data-test="low-sample-badge"
      >
        <i class="fa fa-triangle-exclamation shrink-0" />
        <span class="truncate">{{
          t('tournamentStatsTab.outcomeTypeFunStats.lowSample', {
            count: MIN_WEIGHTED_RATE_MATCHES,
          })
        }}</span>
      </span>

      <InfoTooltip :text="tooltip" />
    </div>

    <!-- Nobody is ahead of anybody: a podium would invent a hierarchy. -->
    <div v-if="board.isFlat" data-test="honour-roll">
      <p class="text-[11px] text-gray-500 mb-2">
        {{ t('tournamentStatsTab.outcomeTypeFunStats.noRanking') }}
      </p>
      <p class="text-xs font-semibold text-gray-300 mb-2">{{ honourRollTitle }}</p>
      <div class="flex flex-wrap gap-1.5">
        <RouterLink
          v-for="p in board.leaders"
          :key="p.playerId"
          :to="playerLink(p.playerId, tournamentId)"
          class="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 pl-1 pr-2.5 py-1 max-w-full"
        >
          <PlayerAvatar
            :name="p.displayName"
            :color-key="p.shortName"
            size="xs"
            shape="circle"
            class="shrink-0"
          />
          <span class="text-xs text-indigo-300 truncate">{{ p.displayName }}</span>
        </RouterLink>
      </div>
      <p v-if="board.omittedCount" class="text-[10px] text-gray-500 mt-2" data-test="more-tied">
        {{ moreTiedLabel }}
      </p>
    </div>

    <div v-else-if="board.leaders.length" :data-test="`${metric}-list`">
      <div
        v-for="(p, i) in board.leaders"
        :key="p.playerId"
        class="py-1.5 border-b border-gray-700 last:border-0"
      >
        <div class="flex justify-between items-center gap-2">
          <RouterLink
            :to="playerLink(p.playerId, tournamentId)"
            class="flex items-center gap-2 min-w-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
          >
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              :class="podiumClass(p.rank)"
              >{{ p.rank }}</span
            >
            <PlayerAvatar
              :name="p.displayName"
              :color-key="p.shortName"
              size="xs"
              shape="square"
              class="shrink-0"
            />
            <span class="truncate">{{ p.displayName }}</span>
          </RouterLink>
          <span class="text-sm font-semibold text-gray-100 tabular-nums shrink-0">{{
            valueLabel(p)
          }}</span>
        </div>
        <div class="flex items-center gap-2 mt-1 pl-7">
          <div class="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full" :class="barClass" :style="{ width: `${barWidth(p)}%` }" />
          </div>
          <span class="text-[10px] text-gray-500 tabular-nums shrink-0">
            {{ subLabel(p) }}
          </span>
        </div>
        <div
          v-if="startsTiedGroup(i)"
          class="flex items-center gap-1 mt-1 pl-7 text-[10px] text-amber-400/80"
          data-test="ex-aequo"
        >
          <i class="fa fa-equals shrink-0" />
          <span>{{ t('tournamentStatsTab.outcomeTypeFunStats.exAequo') }} ({{ p.tiedCount }})</span>
          <InfoTooltip
            :text="
              t('tournamentStatsTab.outcomeTypeFunStats.exAequoTooltip', { count: p.tiedCount })
            "
          />
        </div>
      </div>
      <p v-if="board.omittedCount" class="text-[10px] text-gray-500 pt-1.5" data-test="more-tied">
        {{ moreTiedLabel }}
      </p>
    </div>

    <p v-else class="text-xs text-gray-500 py-1.5">
      {{ t('tournamentStatsTab.outcomeTypeFunStats.noRateData') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OutcomeTypeLeader, OutcomeTypeLeaderboard } from '@skol-arena/shared/types/index'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'
import { playerLink } from '@/utils/player-link'

/** Mirrors MIN_WEIGHTED_RATE_MATCHES in backend/src/services/stats-ranking.ts */
const MIN_WEIGHTED_RATE_MATCHES = 3

const props = defineProps<{
  board: OutcomeTypeLeaderboard
  /** Raw counts, or the rate weighted by sample size. */
  metric: 'volume' | 'rate'
  side: 'winners' | 'losers'
  tournamentId?: string | null
}>()

const { t } = useI18n()

const isWinners = computed(() => props.side === 'winners')
const isVolume = computed(() => props.metric === 'volume')

// A high loss rate is not "efficiency" — the rate column changes meaning with the side.
const title = computed(() => {
  if (isVolume.value) return t('tournamentStatsTab.outcomeTypeFunStats.volume')
  return t(
    isWinners.value
      ? 'tournamentStatsTab.outcomeTypeFunStats.efficiency'
      : 'tournamentStatsTab.outcomeTypeFunStats.vulnerability',
  )
})

const tooltip = computed(() => {
  if (isVolume.value) return t('tournamentStatsTab.outcomeTypeFunStats.volumeTooltip')
  const key = props.board.isLowSample
    ? 'lowSampleTooltip'
    : isWinners.value
      ? 'efficiencyTooltip'
      : 'vulnerabilityTooltip'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { count: MIN_WEIGHTED_RATE_MATCHES })
})

const icon = computed(() => {
  if (isVolume.value) return isWinners.value ? 'fa fa-trophy text-amber-500' : 'fa fa-skull text-gray-400'
  return isWinners.value ? 'fa fa-bullseye text-emerald-500' : 'fa fa-heart-crack text-red-400'
})

const barClass = computed(() => {
  if (isVolume.value) return isWinners.value ? 'bg-amber-500' : 'bg-gray-500'
  return isWinners.value ? 'bg-emerald-500' : 'bg-red-500'
})

const honourRollTitle = computed(() =>
  t(
    isWinners.value
      ? 'tournamentStatsTab.outcomeTypeFunStats.honourRollWinners'
      : 'tournamentStatsTab.outcomeTypeFunStats.honourRollLosers',
    { count: props.board.leaders.length + props.board.omittedCount },
  ),
)

const moreTiedLabel = computed(() =>
  t('tournamentStatsTab.outcomeTypeFunStats.moreTied', { count: props.board.omittedCount }, props.board.omittedCount),
)

function valueLabel(leader: OutcomeTypeLeader): string {
  if (!isVolume.value) return `${leader.ratePct} %`
  const key = isWinners.value ? 'winCount' : 'lossCount'
  return t(`tournamentStatsTab.outcomeTypeFunStats.${key}`, { count: leader.count }, leader.count)
}

function subLabel(leader: OutcomeTypeLeader): string {
  if (isVolume.value) {
    return t('tournamentStatsTab.outcomeTypeFunStats.shareOfTotal', { pct: leader.sharePct })
  }
  return t(
    'tournamentStatsTab.outcomeTypeFunStats.matchCount',
    { count: leader.matchesPlayed },
    leader.matchesPlayed,
  )
}

/** Volume bars are relative to the column leader, so gaps read at a glance. */
function barWidth(leader: OutcomeTypeLeader): number {
  if (!isVolume.value) return leader.ratePct
  const leaderCount = props.board.leaders[0]?.count ?? 0
  if (leaderCount <= 0) return 0
  return Math.round((leader.count / leaderCount) * 100)
}

/** The tie marker belongs to the group, not to each of its rows. */
function startsTiedGroup(index: number): boolean {
  const leader = props.board.leaders[index]
  if (!leader || leader.tiedCount < 2) return false
  return props.board.leaders[index - 1]?.rank !== leader.rank
}

function podiumClass(rank: number): string {
  if (rank === 1) return 'bg-yellow-400 text-yellow-900'
  if (rank === 2) return 'bg-gray-300 text-gray-700'
  return 'bg-amber-600 text-white'
}
</script>
