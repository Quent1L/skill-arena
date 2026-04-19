<template>
  <div>
    <!-- Loading -->
    <div v-if="store.tournamentStatsLoading" class="flex justify-center py-16">
      <ProgressSpinner />
    </div>

    <template v-else-if="store.tournamentStats">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Répartition des fins de match -->
      <div
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-chart-pie mr-2 text-indigo-500" />
          Répartition des fins de match
        </h2>
        <div v-if="isMounted && outcomeChartData" class="flex flex-col sm:flex-row items-center gap-6">
          <div>
            <Chart type="doughnut" :data="outcomeChartData" :options="doughnutOptions" />
          </div>
          <ul class="space-y-2 text-sm">
            <li
              v-for="(item, i) in store.tournamentStats.outcomeDistribution"
              :key="i"
              class="flex items-center gap-2"
            >
              <span
                class="inline-block w-3 h-3 rounded-full shrink-0"
                :style="{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }"
              />
              <span class="text-gray-700 dark:text-gray-300">
                {{ item.outcomeTypeName ?? 'Standard' }}
              </span>
              <span class="font-semibold text-gray-900 dark:text-white ml-auto pl-4">
                {{ item.count }}
              </span>
            </li>
          </ul>
        </div>
        <p v-else class="text-gray-500 dark:text-gray-400 text-sm">
          Aucun match finalisé pour le moment.
        </p>
      </div>

      <!-- Momentum -->
      <div
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-chart-bar mr-2 text-blue-500" />
          Activité du tournoi
        </h2>
        <div v-if="isMounted && momentumChartData" class="h-48">
          <Chart type="line" :data="momentumChartData" :options="lineOptions" class="h-full" />
        </div>
        <p v-else class="text-gray-500 dark:text-gray-400 text-sm">Aucune donnée disponible.</p>
      </div>

      <!-- Meilleure équipe (flex uniquement) -->
      <div
        v-if="store.tournament!.teamMode === 'flex' && store.tournamentStats.bestTeams.length"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-trophy mr-2 text-yellow-500" />
          Meilleures équipes
        </h2>
        <div class="space-y-3">
          <div
            v-for="(team, i) in store.tournamentStats.bestTeams"
            :key="team.entryId"
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="
              i === 0
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-50 dark:bg-gray-800'
            "
          >
            <span
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              :class="podiumClass(i)"
              >{{ i + 1 }}</span
            >
            <span class="flex-1 font-medium text-gray-900 dark:text-white truncate">{{
              team.displayName
            }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400"
              >{{ team.wins }}V {{ team.losses }}D</span
            >
            <span class="text-sm font-semibold" :class="winRateClass(team.winRate)"
              >{{ team.winRate }}%</span
            >
          </div>
        </div>
      </div>

      <!-- Séries de victoires -->
      <div
        v-if="store.tournamentStats.winStreaks.length"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-fire mr-2 text-orange-500" />
          Séries de victoires en cours
        </h2>
        <div class="space-y-2">
          <div
            v-for="entry in store.tournamentStats.winStreaks"
            :key="entry.playerId"
            class="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
          >
            <i class="fa fa-fire text-orange-500 text-lg" />
            <span class="flex-1 font-medium text-gray-900 dark:text-white">{{
              entry.displayName
            }}</span>
            <span class="font-bold text-orange-600 dark:text-orange-400 text-lg">{{
              entry.currentStreak
            }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">victoires consécutives</span>
          </div>
        </div>
      </div>

      <!-- Meilleures séries d'invincibilité -->
      <div
        v-if="store.tournamentStats.invincibleStreaks.length"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-shield mr-2 text-blue-500" />
          Meilleures séries d'invincibilité
        </h2>
        <div class="space-y-2">
          <div
            v-for="entry in store.tournamentStats.invincibleStreaks"
            :key="entry.playerId"
            class="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <i class="fa fa-shield text-blue-500 text-lg" />
            <span class="flex-1 font-medium text-gray-900 dark:text-white">{{ entry.displayName }}</span>
            <span class="font-bold text-blue-600 dark:text-blue-400 text-lg">{{ entry.currentStreak }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">matchs sans défaite</span>
          </div>
        </div>
      </div>

      <!-- Meilleur joueur 2v2 (flex uniquement) -->
      <div
        v-if="store.tournament!.teamMode === 'flex' && store.tournamentStats.bestDuoPlayers.length"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-user-group mr-2 text-purple-500" />
          Meilleurs joueurs 2v2
        </h2>
        <div class="space-y-2">
          <div
            v-for="(player, i) in store.tournamentStats.bestDuoPlayers"
            :key="player.playerId"
            class="flex items-center gap-3 p-3 rounded-lg"
            :class="
              i === 0
                ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                : 'bg-gray-50 dark:bg-gray-800'
            "
          >
            <span
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              :class="podiumClass(i)"
              >{{ i + 1 }}</span
            >
            <span class="flex-1 font-medium text-gray-900 dark:text-white truncate">{{
              player.displayName
            }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400"
              >{{ player.matchesPlayed }} matchs</span
            >
            <span class="text-sm font-semibold" :class="winRateClass(player.winRate)"
              >{{ player.winRate }}%</span
            >
          </div>
        </div>
      </div>

      <!-- Fun stats par type de résultat -->
      <div
        v-if="store.tournamentStats.outcomeTypeFunStats.length"
        class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
          <i class="fa fa-star mr-2 text-amber-500" />
          Stats par type de résultat
        </h2>
        <div class="space-y-4">
          <div
            v-for="stat in store.tournamentStats.outcomeTypeFunStats"
            :key="stat.outcomeTypeId"
            class="border border-gray-100 dark:border-gray-800 rounded-lg p-4"
          >
            <h3
              class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide"
            >
              {{ stat.outcomeTypeName }}
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-if="stat.topWinner"
                class="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3"
              >
                <i class="fa fa-crown text-green-600 dark:text-green-400" />
                <div class="min-w-0">
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    Roi de {{ stat.outcomeTypeName }}
                  </div>
                  <div class="font-semibold text-gray-900 dark:text-white truncate">
                    {{ stat.topWinner.displayName }}
                  </div>
                  <div class="text-xs text-green-600 dark:text-green-400 font-medium">
                    {{ stat.topWinner.count }} fois
                  </div>
                </div>
              </div>
              <div
                v-if="stat.topLoser"
                class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg p-3"
              >
                <i class="fa fa-skull text-red-500 dark:text-red-400" />
                <div class="min-w-0">
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    Victime de {{ stat.outcomeTypeName }}
                  </div>
                  <div class="font-semibold text-gray-900 dark:text-white truncate">
                    {{ stat.topLoser.displayName }}
                  </div>
                  <div class="text-xs text-red-500 dark:text-red-400 font-medium">
                    {{ stat.topLoser.count }} fois
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!store.tournamentStats.totalFinalized"
        class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center"
      >
        <i class="fa fa-chart-bar text-4xl text-gray-300 dark:text-gray-700 mb-4 block" />
        <p class="text-gray-500 dark:text-gray-400">
          Les statistiques s'afficheront une fois les premiers matchs finalisés.
        </p>
      </div>
      </div><!-- end grid -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Chart from 'primevue/chart'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import { formatDate } from 'date-fns'

const store = useTournamentDetailStore()

const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
  store.ensureStats()
})

onBeforeUnmount(() => {
  isMounted.value = false
})

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

const outcomeChartData = computed(() => {
  const stats = store.tournamentStats
  if (!stats || !stats.outcomeDistribution.length) return null
  return {
    labels: stats.outcomeDistribution.map((o) => o.outcomeTypeName ?? 'Standard'),
    datasets: [
      {
        data: stats.outcomeDistribution.map((o) => o.count),
        backgroundColor: PIE_COLORS,
        borderWidth: 1,
        borderColor: 'transparent',
      },
    ],
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
}

const momentumChartData = computed(() => {
  const stats = store.tournamentStats
  if (!stats || !stats.momentum.length) return null
  return {
    labels: stats.momentum.map((d) => formatDate(d.date, 'dd/MM') ),
    datasets: [
      {
        label: 'Matchs',
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

function podiumClass(i: number) {
  if (i === 0) return 'bg-yellow-400 text-yellow-900'
  if (i === 1) return 'bg-gray-300 text-gray-700'
  return 'bg-amber-600 text-white'
}

function winRateClass(rate: number) {
  if (rate >= 60) return 'text-green-600 dark:text-green-400'
  if (rate >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}
</script>
