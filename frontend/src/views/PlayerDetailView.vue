<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-4">
    <!-- Error state -->
    <div v-if="error && !player" class="text-center py-8">
      <p class="text-red-400">{{ error }}</p>
      <Button
        :label="t('playerDetailView.back')"
        icon="fa fa-arrow-left"
        severity="secondary"
        class="mt-4"
        @click="router.back()"
      />
    </div>

    <template v-else>
      <!-- Header card -->
      <div
        class="rounded-2xl bg-gray-800 px-3 py-4 md:px-6 md:py-5 flex items-center gap-2 md:gap-4"
      >
        <Button
          icon="fa fa-arrow-left"
          severity="secondary"
          text
          @click="router.back()"
          class="shrink-0"
        />
        <PlayerAvatar
          :name="player?.displayName ?? '?'"
          :size="avatarSize"
          shape="square"
          class="shrink-0"
        />
        <div class="min-w-0">
          <div class="text-xl md:text-2xl font-black text-white truncate">
            {{ player?.displayName ?? '…' }}
          </div>
          <div v-if="player?.shortName" class="text-xs md:text-sm text-gray-400">
            {{ player.shortName }}
          </div>
        </div>
        <div class="ml-auto shrink-0 flex items-center gap-2">
          <div v-if="canCompare" class="hidden md:block">
            <Button
              :label="t('playerDetailView.compare')"
              icon="fa fa-scale-balanced"
              outlined
              severity="info"
              @click="goToCompare"
            />
          </div>
          <div v-if="canCompare" class="md:hidden">
            <Button icon="fa fa-scale-balanced" severity="secondary" @click="goToCompare" />
          </div>
          <div class="md:hidden">
            <Button
              icon="fa fa-filter"
              severity="secondary"
              @click="showFilterDrawer = true"
              :badge="activeFilterCount > 0 ? String(activeFilterCount) : undefined"
              badge-severity="info"
            />
          </div>
        </div>
      </div>

      <StatsFiltersBar
        v-model="statsFilters"
        v-model:drawer-visible="showFilterDrawer"
        :available-tournaments="availableTournaments"
      />

      <!-- Loading -->
      <div v-if="loading || rankedLoading" class="flex justify-center py-12">
        <ProgressSpinner />
      </div>

      <!-- RANKED TOURNAMENT VIEW -->
      <template v-else-if="isRankedTournament && rankedMmr">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <PlayerMmrProfile
            :mmr="rankedMmr"
            :tiers="rankedTiers"
            :history="rankedHistory"
            :season-id="statsFilters.tournamentId"
            :most-frequent-partners="stats?.mostFrequentPartners"
            :best-partners="stats?.bestPartners"
            :nemeses="stats?.nemeses"
            :opponent-quality="rankedOpponentQuality"
            :recent-form="stats?.recentForm"
            :outcome-type-stats="stats?.outcomeTypeStats"
          />
          <div class="rounded-2xl p-4">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              {{ t('playerDetailView.last10Matches') }}
            </div>
            <MatchList
              :tournament-id="statsFilters.tournamentId"
              :player-id="playerId"
              :current-player-id="playerId"
              :allow-draw="false"
              :player-mode="true"
              :page-size="10"
              :no-scroll="true"
              grid-class="grid grid-cols-1 gap-4"
            />
          </div>
        </div>
      </template>

      <!-- Ranked tournament but player not found in season -->
      <div
        v-else-if="isRankedTournament && !rankedMmr && !rankedLoading"
        class="text-center py-12 text-gray-500"
      >
        <i class="fa fa-user-slash text-4xl mb-4 block opacity-30"></i>
        <p>{{ t('playerDetailView.notInRankedSeason') }}</p>
      </div>

      <!-- FILTERED TOURNAMENT VIEW (non-ranked) -->
      <template v-else-if="statsFilters.tournamentId && stats && stats.totalMatches > 0">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <!-- Stats column -->
          <div class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
              <div class="rounded-xl p-3 text-center bg-gray-800">
                <div class="text-xl font-black text-white">{{ stats.totalMatches }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.matches') }}</div>
              </div>
              <div class="rounded-xl p-3 text-center bg-gray-800">
                <div class="text-xl font-black text-white">{{ stats.winRate }}%</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.winrate') }}</div>
              </div>
              <div class="rounded-xl p-3 text-center bg-gray-800">
                <div class="text-xl font-black">
                  <span class="text-green-400">{{ stats.wins }}</span>
                  <span class="text-gray-600 text-base mx-0.5">/</span>
                  <span class="text-gray-400">{{ stats.draws }}</span>
                  <span class="text-gray-600 text-base mx-0.5">/</span>
                  <span class="text-red-400">{{ stats.losses }}</span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.wldLabel') }}</div>
              </div>
            </div>
            <div v-if="stats.averageScore > 0" class="rounded-xl p-3 text-center bg-gray-800">
              <div class="text-xl font-black text-white">{{ stats.averageScore }}</div>
              <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.avgScore') }}</div>
            </div>
          </div>

          <!-- Partners & Nemeses -->
          <PlayerRelationStats
            class="lg:col-span-2"
            :most-frequent-partners="stats.mostFrequentPartners"
            :best-partners="stats.bestPartners"
            :nemeses="stats.nemeses"
            :tournament-id="statsFilters.tournamentId"
          />
        </div>

        <!-- Recent form -->
        <RecentFormSection v-if="stats.recentForm?.length" :results="stats.recentForm" />

        <!-- Outcome type stats -->
        <OutcomeTypeStats v-if="stats.outcomeTypeStats?.length" :stats="stats.outcomeTypeStats" />

        <!-- H2H rivalries -->
        <H2HRivalries
          v-if="stats.h2hStats?.length"
          :stats="stats.h2hStats"
          :tournament-id="statsFilters.tournamentId"
        />

        <!-- Match history -->
        <div class="rounded-2xl p-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            {{ t('playerDetailView.last10Matches') }}
          </div>
          <MatchList
            :player-id="playerId"
            :tournament-id="statsFilters.tournamentId"
            :page-size="10"
            :no-scroll="true"
          />
        </div>
      </template>

      <!-- UNFILTERED VIEW: grouped by discipline + mode -->
      <template v-else-if="!statsFilters.tournamentId && groupedStats && groupedStats.length > 0">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-for="group in groupedStats" :key="group.key" class="rounded-2xl bg-gray-800 p-4">
            <!-- Group header -->
            <div class="flex items-center gap-2 mb-4">
              <span class="text-sm font-black text-white">{{
                group.discipline ?? t('playerDetailView.allDisciplines')
              }}</span>
              <span class="text-gray-600">·</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-medium"
                >{{ modeLabel(group.mode) }}</span
              >
              <span class="ml-auto text-xs text-gray-500"
                >{{ group.entries.length }} tournoi{{ group.entries.length > 1 ? 's' : '' }}</span
              >
            </div>

            <!-- Stats grid -->
            <div class="grid grid-cols-3 gap-3 mb-3">
              <div class="rounded-xl bg-gray-700/50 p-3 text-center">
                <div class="text-xl font-black text-white">{{ group.totalMatches }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.matches') }}</div>
              </div>
              <div class="rounded-xl bg-gray-700/50 p-3 text-center">
                <div class="text-xl font-black text-white">{{ group.winRate }}%</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.winrate') }}</div>
              </div>
              <div class="rounded-xl bg-gray-700/50 p-3 text-center">
                <div class="text-lg font-black">
                  <span class="text-green-400">{{ group.wins }}V</span>
                  <span class="text-gray-600 text-sm mx-0.5">/</span>
                  <span class="text-red-400">{{ group.losses }}D</span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">{{ t('playerDetailView.wdLabel') }}</div>
              </div>
            </div>

            <!-- Tournaments in group -->
            <div class="space-y-1.5">
              <RouterLink
                v-for="entry in group.entries"
                :key="entry.tournamentId"
                :to="`/tournaments/${entry.tournamentId}`"
                class="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-700/30 hover:bg-gray-700/60 transition-colors"
              >
                <span class="text-sm font-medium text-white truncate">{{
                  entry.tournamentName
                }}</span>
                <span class="text-xs text-gray-400 shrink-0 ml-3 tabular-nums">
                  {{ entry.matchesPlayed }}
                  {{ t('playerDetailView.matchesPlayedAbbr') }} &nbsp;·&nbsp;
                  <span class="text-green-400">{{ entry.wins }}V</span>
                  <span class="text-gray-600"> / </span>
                  <span class="text-red-400">{{ entry.losses }}D</span>
                </span>
              </RouterLink>
            </div>
          </div>
        </div>

        <!-- Global partner / nemesis stats (unfiltered) -->
        <PlayerRelationStats
          v-if="stats"
          :most-frequent-partners="stats.mostFrequentPartners"
          :best-partners="stats.bestPartners"
          :nemeses="stats.nemeses"
          :tournament-id="statsFilters.tournamentId"
        />

        <!-- Recent form -->
        <RecentFormSection v-if="stats?.recentForm?.length" :results="stats.recentForm" />

        <!-- Outcome type stats -->
        <OutcomeTypeStats
          v-if="
            (!hasMultipleDisciplines || statsFilters.disciplineId) && stats?.outcomeTypeStats?.length
          "
          :stats="stats!.outcomeTypeStats"
        />

        <!-- H2H rivalries -->
        <H2HRivalries
          v-if="(!hasMultipleDisciplines || statsFilters.disciplineId) && stats?.h2hStats?.length"
          :stats="stats!.h2hStats"
          :tooltip="t('h2hRivalries.tooltip')"
          :tournament-id="statsFilters.tournamentId"
        />

        <!-- Badges -->
        <PlayerBadges :player-id="playerId" />

        <!-- All matches -->
        <div class="rounded-2xl p-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            {{ t('playerDetailView.last10Matches') }}
          </div>
          <MatchList :player-id="playerId" :page-size="10" :no-scroll="true" />
        </div>
      </template>

      <!-- Empty state -->
      <div v-else-if="!loading && !rankedLoading" class="text-center py-12 text-gray-500">
        <i class="fa fa-chart-bar text-4xl mb-4 block opacity-30"></i>
        <p>{{ t('playerDetailView.noStats') }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import { usePlayerService } from '@/composables/player/player.service'
import { useAuth } from '@/composables/useAuth'
import { rankedApi } from '@/composables/ranked/ranked.api'
import type {
  PlayerStatsFilters,
  PlayerTournamentEntry,
  ClientPlayerMmr,
  ClientRankTier,
  MmrChartPoint,
  OpponentQualityStats,
} from '@skol-arena/shared/types/index'
import MatchList from '@/components/MatchList.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import PlayerRelationStats from '@/components/player/PlayerRelationStats.vue'
import RecentFormSection from '@/components/player/RecentFormSection.vue'
import OutcomeTypeStats from '@/components/player/OutcomeTypeStats.vue'
import H2HRivalries from '@/components/player/H2HRivalries.vue'
import PlayerBadges from '@/components/player/PlayerBadges.vue'
import StatsFiltersBar from '@/components/player/StatsFiltersBar.vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 767px)')
const avatarSize = computed(() => (isMobile.value ? 'md' : 'lg'))
const { appUser } = useAuth()
const {
  player,
  stats,
  availableTournaments,
  loading,
  error,
  loadPlayer,
  loadTournaments,
  loadStats,
} = usePlayerService()

const playerId = computed(() => route.params.id as string)

const initialTournamentId = route.query.tournamentId as string | undefined

const statsFilters = ref<PlayerStatsFilters>(
  initialTournamentId ? { tournamentId: initialTournamentId } : {},
)
const showFilterDrawer = ref(false)

// Ranked tournament detection
const isRankedTournament = computed(() => {
  if (!statsFilters.value.tournamentId) return false
  return (
    availableTournaments.value.find((tour) => tour.id === statsFilters.value.tournamentId)?.mode ===
    'ranked'
  )
})

// Ranked data state
const rankedMmr = ref<ClientPlayerMmr | null>(null)
const rankedTiers = ref<ClientRankTier[]>([])
const rankedHistory = ref<MmrChartPoint[]>([])
const rankedOpponentQuality = ref<OpponentQualityStats | undefined>(undefined)
const rankedLoading = ref(false)

async function loadRankedData(seasonId: string, pid: string) {
  rankedLoading.value = true
  rankedHistory.value = []
  try {
    const [mmrData] = await Promise.all([
      rankedApi.getPlayerMmr(seasonId, pid),
      loadStats(pid, { tournamentId: seasonId }),
    ])
    rankedMmr.value = mmrData.mmr
    rankedTiers.value = mmrData.tiers
    rankedOpponentQuality.value = mmrData.opponentQuality
    rankedHistory.value = mmrData.chartHistory
  } catch {
    rankedMmr.value = null
    rankedTiers.value = []
    rankedOpponentQuality.value = undefined
  } finally {
    rankedLoading.value = false
  }
}

// Grouped stats for unfiltered view
const groupedStats = computed(() => {
  if (statsFilters.value.tournamentId || !stats.value) return null
  type Group = {
    key: string
    discipline: string | null
    mode: string
    entries: PlayerTournamentEntry[]
    totalMatches: number
    wins: number
    draws: number
    losses: number
    winRate: number
  }
  const map = new Map<
    string,
    Omit<Group, 'totalMatches' | 'wins' | 'draws' | 'losses' | 'winRate'> & {
      entries: PlayerTournamentEntry[]
    }
  >()
  for (const e of stats.value.tournamentHistory) {
    const key = `${e.disciplineName ?? ''}_${e.mode}`
    if (!map.has(key))
      map.set(key, { key, discipline: e.disciplineName ?? null, mode: e.mode, entries: [] })
    map.get(key)!.entries.push(e)
  }
  return [...map.values()].map((g): Group => {
    const totalMatches = g.entries.reduce((s, e) => s + e.matchesPlayed, 0)
    const wins = g.entries.reduce((s, e) => s + e.wins, 0)
    const draws = g.entries.reduce((s, e) => s + e.draws, 0)
    const losses = g.entries.reduce((s, e) => s + e.losses, 0)
    return {
      ...g,
      totalMatches,
      wins,
      draws,
      losses,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    }
  })
})

const hasMultipleDisciplines = computed(() => {
  const seen = new Set(
    availableTournaments.value.filter((t) => t.disciplineId).map((t) => t.disciplineId),
  )
  return seen.size > 1
})

const activeFilterCount = computed(
  () =>
    [
      statsFilters.value.tournamentId,
      statsFilters.value.tournamentMode,
      statsFilters.value.disciplineId,
    ].filter(Boolean).length,
)

function modeLabel(mode: string): string {
  if (mode === 'championship') return t('playerDetailView.championship')
  if (mode === 'bracket') return t('playerDetailView.bracket')
  if (mode === 'ranked') return t('playerDetailView.ranked')
  return mode
}

const canCompare = computed(
  () => !!appUser.value && appUser.value.id !== playerId.value && appUser.value.role !== 'kiosk',
)

function goToCompare() {
  const query: Record<string, string> = { b: playerId.value }
  if (statsFilters.value.disciplineId) query.disciplineId = statsFilters.value.disciplineId
  if (statsFilters.value.tournamentMode) query.mode = statsFilters.value.tournamentMode
  if (statsFilters.value.tournamentId) query.tournamentId = statsFilters.value.tournamentId
  router.push({ name: 'player-compare', query })
}

// Load regular stats when filters change (skip for ranked tournaments)
watch(statsFilters, (f) => {
  if (!isRankedTournament.value) {
    loadStats(playerId.value, f)
  }
})

// Load ranked data when a ranked tournament is selected
watch([isRankedTournament, () => statsFilters.value.tournamentId], async ([isRanked, tid]) => {
  if (isRanked && tid) {
    await loadRankedData(tid as string, playerId.value)
  } else if (!isRanked) {
    rankedMmr.value = null
    rankedTiers.value = []
    rankedHistory.value = []
    rankedOpponentQuality.value = undefined
  }
})

onMounted(async () => {
  await Promise.all([loadPlayer(playerId.value), loadTournaments(playerId.value)])
  if (isRankedTournament.value && statsFilters.value.tournamentId) {
    await loadRankedData(statsFilters.value.tournamentId, playerId.value)
  } else {
    loadStats(playerId.value, statsFilters.value)
  }
})
</script>
