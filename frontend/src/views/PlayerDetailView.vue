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
      <div class="rounded-2xl bg-gray-800 px-6 py-5 flex items-center gap-4">
        <Button
          icon="fa fa-arrow-left"
          severity="secondary"
          text
          @click="router.back()"
          class="shrink-0"
        />
        <PlayerAvatar
          :name="player?.displayName ?? '?'"
          size="lg"
          shape="square"
          class="shrink-0 rounded-2xl"
        />
        <div class="min-w-0">
          <div class="text-2xl font-black text-white truncate">
            {{ player?.displayName ?? '…' }}
          </div>
          <div v-if="player?.shortName" class="text-sm text-gray-400">{{ player.shortName }}</div>
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

      <!-- Desktop filters -->
      <div class="hidden md:flex items-center gap-4 bg-gray-800 rounded-2xl p-4">
        <div v-if="hasMultipleDisciplines">
          <div class="flex flex-col gap-1">
            <label
              for="filter-discipline"
              class="text-xs font-bold text-gray-400 uppercase tracking-wide"
              >{{ t('playerDetailView.discipline') }}</label
            >
            <Select
              v-model="selectedDisciplineId"
              input-id="filter-discipline"
              :aria-label="t('playerDetailView.discipline')"
              :options="disciplineOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('playerDetailView.allDisciplinesOption')"
              show-clear
              class="w-40"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label
            for="filter-tournament"
            class="text-xs font-bold text-gray-400 uppercase tracking-wide"
            >{{ t('playerDetailView.tournament') }}</label
          >
          <Select
            v-model="selectedTournamentId"
            input-id="filter-tournament"
            :aria-label="t('playerDetailView.tournament')"
            :options="tournamentOptions"
            option-label="label"
            option-value="value"
            :placeholder="t('playerDetailView.allOption')"
            class="max-w-[60rem]"
            show-clear
          >
            <template #option="{ option }">
              <div class="flex items-center justify-between w-full gap-2">
                <span class="truncate">{{ option.label }}</span>
                <Tag
                  v-if="option.mode"
                  :value="modeLabel(option.mode)"
                  :severity="modeSeverity(option.mode)"
                  class="shrink-0 text-xs"
                />
              </div>
            </template>
          </Select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">{{ t('playerDetailView.mode') }}</span>
          <SelectButton
            v-model="selectedMode"
            :options="modeOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
        <div class="mt-3 flex justify-end">
          <Button
            :label="t('playerDetailView.reset')"
            severity="secondary"
            icon="fa fa-rotate-left"
            size="small"
            @click="resetFilters"
          />
        </div>
      </div>

      <!-- Drawer filtres mobile -->
      <Drawer
        v-model:visible="showFilterDrawer"
        position="bottom"
        :style="{ height: 'auto', maxHeight: '85vh', borderRadius: '1rem 1rem 0 0' }"
        :header="t('playerDetailView.filters')"
      >
        <div class="flex flex-col gap-5 pb-2">
          <div v-if="hasMultipleDisciplines" class="flex flex-col gap-1">
            <label for="filter-discipline-mobile" class="text-sm font-medium">{{ t('playerDetailView.discipline') }}</label>
            <Select
              v-model="draftDisciplineId"
              input-id="filter-discipline-mobile"
              :aria-label="t('playerDetailView.discipline')"
              :options="disciplineOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('playerDetailView.allDisciplines')"
              class="w-full"
              show-clear
            />
          </div>
          <div class="flex flex-col gap-1">
            <label for="filter-tournament-mobile" class="text-sm font-medium">{{ t('playerDetailView.tournament') }}</label>
            <Select
              v-model="draftTournamentId"
              input-id="filter-tournament-mobile"
              :aria-label="t('playerDetailView.tournament')"
              :options="tournamentOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('playerDetailView.allTournaments')"
              class="w-full"
              show-clear
            >
              <template #option="{ option }">
                <div class="flex items-center justify-between w-full gap-2">
                  <span class="truncate">{{ option.label }}</span>
                  <Tag
                    v-if="option.mode"
                    :value="modeLabel(option.mode)"
                    :severity="modeSeverity(option.mode)"
                    class="shrink-0 text-xs"
                  />
                </div>
              </template>
            </Select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium">{{ t('playerDetailView.mode') }}</span>
            <SelectButton
              v-model="draftMode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>
        </div>
        <template #footer>
          <div class="flex gap-3 pt-2">
            <Button
              :label="t('playerDetailView.reset')"
              severity="secondary"
              icon="fa fa-rotate-left"
              class="flex-1"
              @click="resetMobileFilters"
            />
            <Button
              :label="t('playerDetailView.apply')"
              icon="fa fa-check"
              class="flex-1"
              @click="applyMobileFilters"
            />
          </div>
        </template>
      </Drawer>

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
            :season-id="selectedTournamentId"
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
              :tournament-id="selectedTournamentId"
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
      <template v-else-if="selectedTournamentId && stats && stats.totalMatches > 0">
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
            :tournament-id="selectedTournamentId"
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
          :tournament-id="selectedTournamentId"
        />

        <!-- Match history -->
        <div class="rounded-2xl p-4">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            {{ t('playerDetailView.last10Matches') }}
          </div>
          <MatchList
            :player-id="playerId"
            :tournament-id="selectedTournamentId"
            :page-size="10"
            :no-scroll="true"
          />
        </div>
      </template>

      <!-- UNFILTERED VIEW: grouped by discipline + mode -->
      <template v-else-if="!selectedTournamentId && groupedStats && groupedStats.length > 0">
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
                  {{ entry.matchesPlayed }} {{ t('playerDetailView.matchesPlayedAbbr') }} &nbsp;·&nbsp;
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
          :tournament-id="selectedTournamentId"
        />

        <!-- Recent form -->
        <RecentFormSection v-if="stats?.recentForm?.length" :results="stats.recentForm" />

        <!-- Outcome type stats -->
        <OutcomeTypeStats
          v-if="
            (!hasMultipleDisciplines || selectedDisciplineId) && stats?.outcomeTypeStats?.length
          "
          :stats="stats!.outcomeTypeStats"
        />

        <!-- H2H rivalries -->
        <H2HRivalries
          v-if="(!hasMultipleDisciplines || selectedDisciplineId) && stats?.h2hStats?.length"
          :stats="stats!.h2hStats"
          :tooltip="t('h2hRivalries.tooltip')"
          :tournament-id="selectedTournamentId"
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
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
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

const selectedTournamentId = ref<string | undefined>(initialTournamentId)
const selectedMode = ref<string | undefined>(undefined)
const selectedDisciplineId = ref<string | undefined>(undefined)
const draftTournamentId = ref<string | undefined>(initialTournamentId)
const draftMode = ref<string | undefined>(undefined)
const draftDisciplineId = ref<string | undefined>(undefined)
const showFilterDrawer = ref(false)

// Ranked tournament detection
const isRankedTournament = computed(() => {
  if (!selectedTournamentId.value) return false
  return (
    availableTournaments.value.find((tour) => tour.id === selectedTournamentId.value)?.mode === 'ranked'
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
  if (selectedTournamentId.value || !stats.value) return null
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

const tournamentOptions = computed(() => [
  { label: t('playerDetailView.allOption'), value: undefined, mode: undefined },
  ...availableTournaments.value.map((tour) => ({ label: tour.name, value: tour.id, mode: tour.mode })),
])

const modeOptions = computed(() => [
  { label: t('playerDetailView.allOption'), value: undefined },
  { label: t('playerDetailView.championship'), value: 'championship' },
  { label: t('playerDetailView.bracket'), value: 'bracket' },
  { label: t('playerDetailView.ranked'), value: 'ranked' },
])

function modeLabel(mode: string): string {
  if (mode === 'championship') return t('playerDetailView.championship')
  if (mode === 'bracket') return t('playerDetailView.bracket')
  if (mode === 'ranked') return t('playerDetailView.ranked')
  return mode
}

function modeSeverity(mode: string): string {
  if (mode === 'championship') return 'info'
  if (mode === 'bracket') return 'warning'
  if (mode === 'ranked') return 'success'
  return 'secondary'
}

const disciplineOptions = computed(() => {
  const seen = new Set<string>()
  const opts: { label: string; value: string | undefined }[] = [
    { label: t('playerDetailView.allDisciplinesOption'), value: undefined },
  ]
  for (const tour of availableTournaments.value) {
    if (tour.disciplineId && !seen.has(tour.disciplineId)) {
      seen.add(tour.disciplineId)
      opts.push({ label: tour.disciplineName ?? tour.disciplineId, value: tour.disciplineId })
    }
  }
  return opts
})

const hasMultipleDisciplines = computed(() => disciplineOptions.value.length > 1)

const activeFilterCount = computed(
  () =>
    [selectedTournamentId.value, selectedMode.value, selectedDisciplineId.value].filter(Boolean)
      .length,
)

function applyFilters(
  tournamentId: string | undefined,
  mode: string | undefined,
  disciplineId: string | undefined,
) {
  const filters: PlayerStatsFilters = {}
  if (tournamentId) filters.tournamentId = tournamentId
  if (mode) filters.tournamentMode = mode
  if (disciplineId) filters.disciplineId = disciplineId
  loadStats(playerId.value, filters)
}

const canCompare = computed(
  () => !!appUser.value && appUser.value.id !== playerId.value && appUser.value.role !== 'kiosk',
)

function goToCompare() {
  const query: Record<string, string> = { b: playerId.value }
  if (selectedDisciplineId.value) query.disciplineId = selectedDisciplineId.value
  if (selectedMode.value) query.mode = selectedMode.value
  if (selectedTournamentId.value) query.tournamentId = selectedTournamentId.value
  router.push({ name: 'player-compare', query })
}

function resetFilters() {
  selectedTournamentId.value = undefined
  selectedMode.value = undefined
  selectedDisciplineId.value = undefined
  draftTournamentId.value = undefined
  draftMode.value = undefined
  draftDisciplineId.value = undefined
}

function resetMobileFilters() {
  draftTournamentId.value = undefined
  draftMode.value = undefined
  draftDisciplineId.value = undefined
}

function applyMobileFilters() {
  selectedTournamentId.value = draftTournamentId.value
  selectedMode.value = draftMode.value
  selectedDisciplineId.value = draftDisciplineId.value
  showFilterDrawer.value = false
}

// Load regular stats when filter changes (skip for ranked tournaments)
watch([selectedTournamentId, selectedMode, selectedDisciplineId], ([tid, mode, did]) => {
  if (!isRankedTournament.value) {
    applyFilters(tid ?? undefined, mode ?? undefined, did ?? undefined)
  }
})

// Load ranked data when a ranked tournament is selected
watch([isRankedTournament, selectedTournamentId], async ([isRanked, tid]) => {
  if (isRanked && tid) {
    await loadRankedData(tid, playerId.value)
  } else if (!isRanked) {
    rankedMmr.value = null
    rankedTiers.value = []
    rankedHistory.value = []
    rankedOpponentQuality.value = undefined
  }
})

onMounted(async () => {
  await Promise.all([loadPlayer(playerId.value), loadTournaments(playerId.value)])
  if (isRankedTournament.value && selectedTournamentId.value) {
    await loadRankedData(selectedTournamentId.value, playerId.value)
  } else {
    applyFilters(selectedTournamentId.value, selectedMode.value, selectedDisciplineId.value)
  }
})
</script>
