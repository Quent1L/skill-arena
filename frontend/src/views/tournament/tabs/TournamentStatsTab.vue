<template>
  <div>
    <!-- Loading -->
    <div v-if="store.tournamentStatsLoading" class="flex justify-center py-16">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="store.statsError"
      class="flex flex-col items-center py-16 text-red-500 dark:text-red-400 gap-3"
    >
      <i class="fa fa-triangle-exclamation text-3xl" />
      <p>{{ store.statsError }}</p>
    </div>

    <template v-else-if="store.tournamentStats">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Weekly MMR movers (ranked seasons only) -->
        <div
          v-if="hasWeeklyMmr"
          class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
            <i class="fa fa-calendar-week mr-2 text-cyan-500" />
            {{ t('tournamentStatsTab.weeklyMmr.title') }}
          </h2>
          <WeeklyMmrLeaders
            :gainers="store.weeklyMmrLeaders!.gainers"
            :losers="store.weeklyMmrLeaders!.losers"
            :tournament-id="store.tournament?.id"
          />
        </div>
        <!-- Match outcome breakdown -->
        <div
          v-if="hasOutcomeTypes"
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
            <i class="fa fa-chart-pie mr-2 text-indigo-500" />
            {{ t('tournamentStatsTab.outcomeDistribution.title') }}
          </h2>
          <div v-if="isMounted" class="flex flex-col sm:flex-row items-center gap-6">
            <MatchOutcomeDistribution
              class="w-full"
              :items="
                store.tournamentStats.outcomeDistribution.map((o) => ({
                  label: o.outcomeTypeName ?? 'Standard',
                  count: o.count,
                }))
              "
            />
          </div>
          <p v-else class="text-gray-500 dark:text-gray-400 text-sm">
            {{ t('tournamentStatsTab.outcomeDistribution.empty') }}
          </p>
        </div>

        <!-- Momentum -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
            <i class="fa fa-chart-bar mr-2 text-blue-500" />
            {{ t('tournamentStatsTab.activity.title') }}
          </h2>
          <div v-if="isMounted && momentumChartData" class="h-48">
            <Chart type="line" :data="momentumChartData" :options="lineOptions" class="h-full" />
          </div>
          <p v-else class="text-gray-500 dark:text-gray-400 text-sm">
            {{ t('tournamentStatsTab.activity.empty') }}
          </p>
        </div>

        <!-- Best team (flex only) -->
        <TopPlayersCard
          v-if="store.tournament!.teamMode === 'flex' && bestTeamsItems.length"
          :title="t('tournamentStatsTab.bestTeams.title')"
          icon="fa fa-trophy"
          icon-class="text-yellow-500"
          first-row-class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
          :items="bestTeamsItems"
        />

        <!-- Win streaks -->
        <StreakLeadersCard
          v-if="store.tournamentStats.winStreaks.length"
          :title="t('tournamentStatsTab.winStreaks.title')"
          icon="fa fa-fire"
          variant="orange"
          :entries="store.tournamentStats.winStreaks"
          :unit-label="t('tournamentStatsTab.winStreaks.consecutiveWins')"
        />

        <!-- Current losing streaks -->
        <StreakLeadersCard
          v-if="store.tournamentStats.lossStreaks.length"
          :title="t('tournamentStatsTab.lossStreaks.title')"
          icon="fa fa-skull-crossbones"
          variant="red"
          :entries="store.tournamentStats.lossStreaks"
          :unit-label="t('tournamentStatsTab.lossStreaks.consecutiveLosses')"
        />

        <!-- Best unbeaten streaks -->
        <StreakLeadersCard
          v-if="store.tournamentStats.invincibleStreaks.length"
          :title="t('tournamentStatsTab.invincibleStreaks.title')"
          icon="fa fa-shield"
          variant="blue"
          :entries="store.tournamentStats.invincibleStreaks"
          :unit-label="t('tournamentStatsTab.invincibleStreaks.unbeatenMatches')"
        />

        <!-- Best solo player (asymmetric only) -->
        <TopPlayersCard
          v-if="bestAsymmetricSoloItems.length"
          :title="t('tournamentStatsTab.bestAsymmetricSolo.title')"
          icon="fa fa-user-shield"
          icon-class="text-indigo-500"
          first-row-class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
          :items="bestAsymmetricSoloItems"
        />

        <!-- Best 1v1 player -->
        <TopPlayersCard
          v-if="bestSoloItems.length"
          :title="t('tournamentStatsTab.bestSolo.title')"
          icon="fa fa-user"
          icon-class="text-green-500"
          first-row-class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          :items="bestSoloItems"
        />

        <!-- Best 2v2 player (flex only) -->
        <TopPlayersCard
          v-if="store.tournament!.teamMode === 'flex' && bestDuoItems.length"
          :title="t('tournamentStatsTab.bestDuo.title')"
          icon="fa fa-user-group"
          icon-class="text-purple-500"
          first-row-class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
          :items="bestDuoItems"
        />

        <!-- Fun stats by outcome type -->
        <div
          v-if="store.tournamentStats.outcomeTypeFunStats.length"
          class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-6"
        >
          <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
            <i class="fa fa-star mr-2 text-amber-500" />
            {{ t('tournamentStatsTab.outcomeTypeFunStats.title') }}
          </h2>
          <OutcomeTypeFunStats
            :stats="store.tournamentStats.outcomeTypeFunStats"
            :tournament-id="store.tournament?.id"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="!store.tournamentStats.totalFinalized"
          class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center"
        >
          <i class="fa fa-chart-bar text-4xl text-gray-300 dark:text-gray-700 mb-4 block" />
          <p class="text-gray-500 dark:text-gray-400">
            {{ t('tournamentStatsTab.emptyStats') }}
          </p>
        </div>
      </div>
      <!-- end grid -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import Chart from 'primevue/chart'
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import { formatDate } from 'date-fns'
import type { BestDuoEntry } from '@skol-arena/shared/types/index'
import TopPlayersCard, { type TopPlayerItem } from '@/components/tournament/TopPlayersCard.vue'
import MatchOutcomeDistribution from '@/components/stats/MatchOutcomeDistribution.vue'
import OutcomeTypeFunStats from '@/components/stats/OutcomeTypeFunStats.vue'
import StreakLeadersCard from '@/components/stats/StreakLeadersCard.vue'
import WeeklyMmrLeaders from '@/components/ranked/WeeklyMmrLeaders.vue'

const store = useTournamentDetailStore()
const { t } = useI18n()

const isMounted = ref(false)

onMounted(async () => {
  await Promise.all([store.ensureStats(), store.ensureWeeklyMmrLeaders()])
  await nextTick()
  isMounted.value = true
})

onBeforeUnmount(() => {
  isMounted.value = false
})

const momentumChartData = computed(() => {
  const stats = store.tournamentStats
  if (!stats || !stats.momentum.length) return null
  return {
    labels: stats.momentum.map((d) => formatDate(d.date, 'dd/MM')),
    datasets: [
      {
        label: t('tournamentStatsTab.chartLabel'),
        data: stats.momentum.map((d) => d.matchCount),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true,
      },
    ],
  }
})

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 },
    },
  },
  elements: {
    line: { tension: 0.4 },
    point: { radius: 3 },
  },
}

const hasWeeklyMmr = computed(() => {
  const weekly = store.weeklyMmrLeaders
  return !!weekly && (weekly.gainers.length > 0 || weekly.losers.length > 0)
})

const hasOutcomeTypes = computed(() =>
  (store.tournamentStats?.outcomeDistribution ?? []).some((o) => o.outcomeTypeName),
)

const bestTeamsItems = computed(() =>
  (store.tournamentStats?.bestTeams ?? []).map((team) => ({
    id: team.entryId,
    displayName: team.displayName,
    secondaryText: `${team.wins}V ${team.losses}D`,
    winRate: team.winRate,
    rank: team.rank,
    tiedCount: team.tiedCount,
  })),
)

/** The player cards differ only by which list they read: same row shape for all three. */
function toPlayerItems(players: BestDuoEntry[] | undefined): TopPlayerItem[] {
  return (players ?? []).map((p) => ({
    id: p.playerId,
    displayName: p.displayName,
    secondaryText: `${p.matchesPlayed} matchs`,
    winRate: p.winRate,
    rank: p.rank,
    tiedCount: p.tiedCount,
  }))
}

const bestDuoItems = computed(() => toPlayerItems(store.tournamentStats?.bestDuoPlayers))

const bestSoloItems = computed(() => toPlayerItems(store.tournamentStats?.bestSoloPlayers))

const bestAsymmetricSoloItems = computed(() =>
  toPlayerItems(store.tournamentStats?.bestAsymmetricSoloPlayers),
)
</script>
