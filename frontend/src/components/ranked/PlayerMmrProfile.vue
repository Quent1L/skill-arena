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
        <div class="text-xs font-bold tracking-widest uppercase text-white/50 mb-1">Rang actuel</div>
        <div class="text-2xl font-black tracking-wide uppercase" :class="tierTextClass">
          {{ tierLabel(rank) }}
        </div>

      </div>

      <!-- MMR + position -->
      <div class="text-center pb-4 px-6">
        <div class="text-5xl font-black text-white tabular-nums">
          {{ mmr.currentMmr.toLocaleString('fr-FR') }}
        </div>
        <div class="text-xs uppercase tracking-widest text-white/40 mt-1">MMR</div>
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

      <!-- Progress bar toward next tier -->
      <div v-if="progressData" class="px-6 pb-6">
        <div class="flex justify-between text-xs text-white/40 mb-1.5">
          <span class="font-semibold" :class="tierTextClass">{{ tierLabel(rank) }}</span>
          <span>{{ progressData.mmrToNext }} MMR manquants</span>
          <span class="font-semibold" :class="nextTierTextClass">{{ tierLabel(progressData.nextTier) }}</span>
        </div>
        <div class="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="progressBarClass"
            :style="{ width: `${progressData.percent}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div class="text-xl font-black text-white">{{ mmr.matchesPlayed }}</div>
        <div class="text-xs text-gray-400 mt-0.5">Matchs</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div class="text-xl font-black text-white">{{ winrate }}%</div>
        <div class="text-xs text-gray-400 mt-0.5">Winrate</div>
      </div>
      <div class="rounded-xl p-3 text-center bg-gray-800">
        <div
          class="text-xl font-black"
          :class="mmr.winStreak > 0 ? 'text-orange-400' : 'text-gray-500'"
        >
          {{ mmr.winStreak > 0 ? mmr.winStreak : '—' }}
        </div>
        <div class="text-xs text-gray-400 mt-0.5">Streak</div>
      </div>
    </div>

    <!-- W/L + max streak -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl p-4 bg-gray-800">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Victoires / Défaites</div>
        <div class="text-2xl font-black">
          <span class="text-green-400">{{ mmr.wins }}V</span>
          <span class="text-gray-600 mx-1">/</span>
          <span class="text-red-400">{{ mmr.losses }}D</span>
        </div>
      </div>
      <div class="rounded-xl p-4 bg-gray-800">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Meilleure série</div>
        <div class="text-2xl font-black text-orange-400">
          {{ mmr.maxWinStreak > 0 ? `🔥 ${mmr.maxWinStreak}` : '—' }}
        </div>
      </div>
    </div>

    <!-- MMR Progression Chart -->
    <div v-if="isMounted && sortedHistory.length > 1" class="rounded-xl p-4 bg-gray-800">
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Progression MMR</div>
      <Chart type="line" :data="chartData" :options="chartOptions" class="h-40" />
    </div>


  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Chart from 'primevue/chart'
import type { ClientPlayerMmr, ClientMmrHistoryEntry, ClientRankTier } from '@skill-arena/shared/types/index'

const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
onBeforeUnmount(() => { isMounted.value = false })

const CARD_BG = [
  'bg-gradient-to-b from-gray-700/80 to-gray-900',
  'bg-gradient-to-b from-blue-900/80 to-gray-900',
  'bg-gradient-to-b from-amber-900/80 to-gray-900',
  'bg-gradient-to-b from-red-900/80 to-gray-900',
]
const ICON_BG = ['bg-gray-600', 'bg-blue-600', 'bg-amber-500', 'bg-red-600']
const TIER_TEXT = ['text-gray-400', 'text-blue-400', 'text-amber-400', 'text-red-400']
const PROGRESS_BAR = ['bg-gray-500', 'bg-blue-500', 'bg-amber-400', 'bg-red-500']
const TIER_ICON = ['fa fa-gem', 'fa fa-shield', 'fa fa-star', 'fa fa-crown']

const props = defineProps<{
  mmr: ClientPlayerMmr
  tiers: ClientRankTier[]
  initialMmr?: number
  leaderboardRank?: number
  history?: ClientMmrHistoryEntry[]
}>()

function styleIdx(tier: ClientRankTier | null): number {
  if (!tier) return 0
  return Math.min(tier.level - 1, TIER_TEXT.length - 1)
}

const rank = computed((): ClientRankTier | null => {
  if (!props.tiers.length) return null
  const mmr = props.mmr.currentMmr
  return [...props.tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? props.tiers[0]
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

const progressData = computed(() => {
  if (!props.tiers.length || !rank.value) return null
  const sorted = [...props.tiers].sort((a, b) => a.level - b.level)
  const maxLevel = sorted[sorted.length - 1].level
  if (rank.value.level === maxLevel) return null

  const nextTier = sorted.find((t) => t.level === rank.value!.level + 1)
  if (!nextTier) return null

  const currentThreshold = rank.value.minMmr
  const nextThreshold = nextTier.minMmr
  const mmrInTier = props.mmr.currentMmr - currentThreshold
  const tierRange = nextThreshold - currentThreshold
  const percent = tierRange > 0 ? Math.min(100, Math.round((mmrInTier / tierRange) * 100)) : 0
  const mmrToNext = nextThreshold - props.mmr.currentMmr

  return { nextTier, percent, mmrToNext }
})

const cardBgClass = computed(() => CARD_BG[styleIdx(rank.value)])
const iconBgClass = computed(() => ICON_BG[styleIdx(rank.value)])
const tierTextClass = computed(() => TIER_TEXT[styleIdx(rank.value)])
const nextTierTextClass = computed(() =>
  progressData.value ? TIER_TEXT[styleIdx(progressData.value.nextTier)] : ''
)
const progressBarClass = computed(() =>
  progressData.value ? PROGRESS_BAR[styleIdx(progressData.value.nextTier)] : ''
)
const tierIcon = computed(() => TIER_ICON[styleIdx(rank.value)])

function tierLabel(tier: ClientRankTier | null): string {
  return tier?.name ?? '—'
}

const sortedHistory = computed(() =>
  [...(props.history ?? [])]
    .filter((e) => e.match != null)
    .sort((a, b) => new Date(a.match!.playedAt).getTime() - new Date(b.match!.playedAt).getTime()),
)

const chartData = computed(() => ({
  labels: sortedHistory.value.map((_, i) => `M${i + 1}`),
  datasets: [
    {
      label: 'MMR',
      data: sortedHistory.value.map((e) => e.mmrAfter),
      pointBackgroundColor: sortedHistory.value.map((e) =>
        e.mmrDelta >= 0 ? '#22c55e' : '#ef4444',
      ),
      pointBorderColor: sortedHistory.value.map((e) =>
        e.mmrDelta >= 0 ? '#22c55e' : '#ef4444',
      ),
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
          const entry = sortedHistory.value[items[0].dataIndex]
          return new Date(entry.match!.playedAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          })
        },
        label: (item: { dataIndex: number }) => {
          const entry = sortedHistory.value[item.dataIndex]
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
