<template>
  <div class="player-mmr-profile space-y-3">
    <!-- Main rank card -->
    <div class="rounded-2xl overflow-hidden" :class="cardBgClass">
      <!-- Top: icon + rank -->
      <div class="flex flex-col items-center pt-8 pb-4 px-6">
        <div
          class="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
          :class="iconBgClass"
        >
          <i :class="tierIcon" class="text-white text-3xl" />
        </div>
        <div class="text-xs font-bold tracking-widest uppercase text-white/50 mb-1">
          {{ t('playerMmrProfile.currentRank') }}
        </div>
        <div class="text-2xl font-black tracking-wide uppercase" :class="tierTextClass">
          {{ rank?.name ?? '—' }}
        </div>
      </div>

      <!-- MMR + position -->
      <div class="text-center pb-4 px-6">
        <div class="text-5xl font-black text-white tabular-nums">
          {{ mmr.currentMmr.toLocaleString('fr-FR') }}
        </div>
        <div class="text-xs uppercase tracking-widest text-white/40 mt-1">
          {{ t('playerMmrProfile.mmrLabel') }}
        </div>
        <div class="flex items-center justify-center gap-3 mt-3">
          <div
            v-if="leaderboardRank"
            class="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-sm font-bold text-white"
          >
            <i class="fa fa-trophy text-amber-400 text-xs" />
            #{{ leaderboardRank }}
          </div>
          <div
            v-if="mmrDelta !== null"
            class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold"
            :class="mmrDelta >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'"
          >
            {{ mmrDelta > 0 ? '+' : '' }}{{ mmrDelta }}
          </div>
        </div>
      </div>

      <!-- LP progress bar toward next tier -->
      <div v-if="lpProgress" class="px-6 pb-6">
        <div class="flex justify-between text-xs text-white/40 mb-1.5">
          <span class="font-semibold" :class="tierTextClass">{{ rank?.name }}</span>
          <span>{{ lpProgress.lp }} / {{ lpProgress.tierRange }} LP</span>
          <span class="font-semibold" :class="nextTierTextClass">{{ lpProgress.nextLabel }}</span>
        </div>
        <div class="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="progressBarClass"
            :style="{ width: `${lpProgress.percent}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div class="text-xl font-black text-white">{{ mmr.matchesPlayed }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ t('playerMmrProfile.matchesLabel') }}</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div class="text-xl font-black text-white">{{ winrate }}%</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ t('playerMmrProfile.winrateLabel') }}</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div
          class="text-xl font-black"
          :class="
            mmr.winStreak > 1
              ? 'text-orange-400'
              : mmr.lossStreak > 1
                ? 'text-blue-400'
                : 'text-gray-500'
          "
        >
          {{
            mmr.winStreak > 1
              ? `🔥 ${mmr.winStreak}`
              : mmr.lossStreak > 1
                ? `💀 ${mmr.lossStreak}`
                : '—'
          }}
        </div>
        <div class="text-xs text-gray-400 mt-0.5">{{ t('playerMmrProfile.currentStreak') }}</div>
      </div>
    </div>

    <!-- W/L + max streaks -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div class="col-span-2 sm:col-span-1 rounded-xl p-4 bg-gray-800">
        <div
          class="text-xs font-bold text-gray-400 normal-case sm:uppercase tracking-normal sm:tracking-wide mb-2"
        >
          {{ t('playerMmrProfile.winsLosses') }}
        </div>
        <div class="text-2xl font-black">
          <span class="text-green-400">{{ mmr.wins }}{{ t('playerMmrProfile.winsShort') }}</span>
          <span class="text-gray-600 mx-1">/</span>
          <span class="text-red-400">{{ mmr.losses }}{{ t('playerMmrProfile.lossesShort') }}</span>
        </div>
      </div>
      <div class="rounded-xl p-4 bg-gray-800">
        <div
          class="text-xs font-bold text-gray-400 normal-case sm:uppercase tracking-normal sm:tracking-wide mb-2"
        >
          {{ t('playerMmrProfile.bestStreak') }}
        </div>
        <div class="text-2xl font-black text-orange-400">
          {{ mmr.maxWinStreak > 0 ? `🔥 ${mmr.maxWinStreak}` : '—' }}
        </div>
      </div>
      <div class="rounded-xl p-4 bg-gray-800">
        <div
          class="text-xs font-bold text-gray-400 normal-case sm:uppercase tracking-normal sm:tracking-wide mb-2"
        >
          {{ t('playerMmrProfile.worstStreak') }}
        </div>
        <div class="text-2xl font-black text-blue-400">
          {{ mmr.maxLossStreak > 0 ? `💀 ${mmr.maxLossStreak}` : '—' }}
        </div>
      </div>
    </div>

    <!-- Recent form -->
    <RecentFormSection v-if="recentForm?.length" :results="recentForm" />

    <!-- MMR Progression Chart -->
    <div v-if="isMounted && chartPoints.length > 1" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        {{ t('playerMmrProfile.mmrProgression') }}
      </div>
      <Chart type="line" :data="chartData" :options="chartOptions" class="h-40" />
    </div>

    <!-- Outcome type distribution -->
    <div v-if="outcomeTypeStats?.length" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        {{ t('playerMmrProfile.outcomeDistribution') }}
      </div>
      <MatchOutcomeDistribution
        :items="
          outcomeTypeStats.map((s) => ({
            label: s.outcomeTypeName,
            count: s.matchesPlayed,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
          }))
        "
      />
    </div>

    <!-- Opponent quality -->
    <div v-if="opponentQuality" class="rounded-xl p-4 bg-gray-800">
      <div
        class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"
      >
        {{ t('playerMmrProfile.winrateByOpponentLevel') }}
        <InfoTooltip :text="t('playerMmrProfile.opponentLevelTooltip')" html />
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-gray-700/50 p-2">
          <div class="text-xs text-gray-400 mb-1">{{ t('playerMmrProfile.vsStronger') }}</div>
          <div
            class="text-sm font-black"
            :class="opponentQuality.vsStronger.matchesPlayed > 0 ? 'text-white' : 'text-gray-600'"
          >
            {{
              opponentQuality.vsStronger.matchesPlayed > 0
                ? `${opponentQuality.vsStronger.winRate}%`
                : '—'
            }}
          </div>
          <div class="text-[10px] text-gray-500">
            {{ opponentQuality.vsStronger.matchesPlayed }} {{ t('playerMmrProfile.matchesCount') }}
          </div>
        </div>
        <div class="rounded-lg bg-gray-700/50 p-2">
          <div class="text-xs text-gray-400 mb-1">{{ t('playerMmrProfile.vsEqual') }}</div>
          <div
            class="text-sm font-black"
            :class="opponentQuality.vsEqual.matchesPlayed > 0 ? 'text-white' : 'text-gray-600'"
          >
            {{
              opponentQuality.vsEqual.matchesPlayed > 0
                ? `${opponentQuality.vsEqual.winRate}%`
                : '—'
            }}
          </div>
          <div class="text-[10px] text-gray-500">
            {{ opponentQuality.vsEqual.matchesPlayed }} {{ t('playerMmrProfile.matchesCount') }}
          </div>
        </div>
        <div class="rounded-lg bg-gray-700/50 p-2">
          <div class="text-xs text-gray-400 mb-1">{{ t('playerMmrProfile.vsWeaker') }}</div>
          <div
            class="text-sm font-black"
            :class="opponentQuality.vsWeaker.matchesPlayed > 0 ? 'text-white' : 'text-gray-600'"
          >
            {{
              opponentQuality.vsWeaker.matchesPlayed > 0
                ? `${opponentQuality.vsWeaker.winRate}%`
                : '—'
            }}
          </div>
          <div class="text-[10px] text-gray-500">
            {{ opponentQuality.vsWeaker.matchesPlayed }} {{ t('playerMmrProfile.matchesCount') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Partner / nemesis stats -->
    <PlayerRelationStats
      :most-frequent-partners="mostFrequentPartners"
      :best-partners="bestPartners"
      :nemeses="nemeses"
      :tournament-id="seasonId"
    />

    <!-- Earned badges -->
    <PlayerBadges :player-id="mmr.playerId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Chart from 'primevue/chart'
import type {
  ClientPlayerMmr,
  MmrChartPoint,
  ClientRankTier,
  PlayerRelationStat,
  OpponentQualityStats,
  PlayerOutcomeTypeStat,
} from '@skol-arena/shared/types/index'
import InfoTooltip from '@/components/InfoTooltip.vue'
import PlayerRelationStats from '@/components/player/PlayerRelationStats.vue'
import PlayerBadges from '@/components/player/PlayerBadges.vue'
import RecentFormSection from '@/components/player/RecentFormSection.vue'
import MatchOutcomeDistribution from '@/components/stats/MatchOutcomeDistribution.vue'
import { getLp, isTopTier, TIER_SIZE } from '@/composables/ranked/ranked.service'
import {
  TIER_ICON,
  TIER_TEXT_CLASS as TIER_TEXT,
  TIER_ICON_BG_CLASS as ICON_BG,
  TIER_CARD_BG_CLASS as CARD_BG,
  TIER_PROGRESS_BAR_CLASS as PROGRESS_BAR,
  tierStyleIdx as styleIdx,
} from '@/composables/ranked/tier-style'

const { t } = useI18n()

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
onBeforeUnmount(() => {
  isMounted.value = false
})

const props = defineProps<{
  mmr: ClientPlayerMmr
  tiers: ClientRankTier[]
  initialMmr?: number
  leaderboardRank?: number
  history?: MmrChartPoint[]
  seasonId?: string
  mostFrequentPartners?: PlayerRelationStat[]
  bestPartners?: PlayerRelationStat[]
  nemeses?: PlayerRelationStat[]
  opponentQuality?: OpponentQualityStats
  recentForm?: Array<'V' | 'D' | 'N'>
  outcomeTypeStats?: PlayerOutcomeTypeStat[]
}>()

const rank = computed((): ClientRankTier | null => {
  if (!props.tiers.length) return null
  const mmr = props.mmr.currentMmr
  return (
    [...props.tiers].sort((a, b) => b.level - a.level).find((tier) => mmr >= tier.minMmr) ??
    props.tiers[0]
  )
})

const mmrDelta = computed(() => {
  if (props.initialMmr === undefined) return null
  return props.mmr.currentMmr - props.initialMmr
})

const winrate = computed(() => {
  const total = props.mmr.wins + props.mmr.losses
  if (total === 0) return 0
  return Math.round((props.mmr.wins / total) * 100)
})

const lpProgress = computed(() => {
  if (!props.tiers.length || !rank.value) return null
  if (isTopTier(rank.value, props.tiers)) return null
  const mmrVal = props.mmr.currentMmr
  const sorted = [...props.tiers].sort((a, b) => a.level - b.level)
  const nextTier = sorted.find((tier) => tier.level > rank.value!.level) ?? null
  const lp = getLp(mmrVal, rank.value)
  const tierRange = nextTier ? nextTier.minMmr - rank.value.minMmr : TIER_SIZE
  const percent = Math.min(100, Math.round((lp / tierRange) * 100))
  return {
    lp,
    tierRange,
    percent,
    nextLabel: nextTier?.name ?? '',
    nextTierForStyle: nextTier ?? rank.value,
  }
})

const cardBgClass = computed(() => CARD_BG[styleIdx(rank.value)])
const iconBgClass = computed(() => ICON_BG[styleIdx(rank.value)])
const tierTextClass = computed(() => TIER_TEXT[styleIdx(rank.value)])
const nextTierTextClass = computed(() =>
  lpProgress.value ? TIER_TEXT[styleIdx(rank.value)] : '',
)
const progressBarClass = computed(() =>
  lpProgress.value ? PROGRESS_BAR[styleIdx(rank.value)] : '',
)
const tierIcon = computed(() => TIER_ICON[styleIdx(rank.value)])

const chartPoints = computed(() => props.history ?? [])

const chartData = computed(() => ({
  labels: chartPoints.value.map((_, i) => `M${i + 1}`),
  datasets: [
    {
      label: t('playerMmrProfile.mmrLabel'),
      data: chartPoints.value.map((e) => e.mmrAfter),
      pointBackgroundColor: chartPoints.value.map((e) => (e.mmrDelta >= 0 ? '#22c55e' : '#ef4444')),
      pointBorderColor: chartPoints.value.map((e) => (e.mmrDelta >= 0 ? '#22c55e' : '#ef4444')),
      pointRadius: 5,
      borderColor: '#6366f1',
      borderWidth: 2,
      fill: true,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.3,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: { dataIndex: number }[]) => {
          const entry = chartPoints.value[items[0].dataIndex]
          return new Date(entry.playedAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          })
        },
        label: (item: { dataIndex: number }) => {
          const entry = chartPoints.value[item.dataIndex]
          const d = entry.mmrDelta
          return `${entry.mmrAfter} MMR (${d > 0 ? '+' : ''}${d})`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.08)' },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.08)' },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } },
    },
  },
}))
</script>
