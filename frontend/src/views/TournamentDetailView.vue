<template>
  <div>
  <!-- Initial loading -->
  <div v-if="isInitialLoading">
    <div v-if="isMobile" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>
    <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-6">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-3 mb-4">
            <Skeleton shape="circle" size="2.5rem" />
            <Skeleton height="2rem" width="40%" />
          </div>
          <Skeleton height="1rem" width="20%" class="mb-1" />
        </div>
      </div>
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto px-6">
          <Skeleton height="3rem" />
        </div>
      </div>
      <div class="max-w-5xl mx-auto px-6 py-6">
        <div class="grid grid-cols-3 gap-4">
          <Skeleton height="8rem" v-for="i in 6" :key="i" />
        </div>
      </div>
    </div>
  </div>

  <Message v-else-if="error" severity="error" class="mb-6 mx-4 mt-4">
    {{ error }}
  </Message>

  <div v-else-if="tournament">
    <!-- Mobile version (unchanged) -->
    <div v-if="isMobile" class="h-full">
      <TournamentDetailMobile
        :tournament="tournament"
        :participants="participants"
        :participant-count="participantCount"
        :loading-participants="loadingParticipants"
        :is-authenticated="isAuthenticated"
        :is-participant="isParticipant"
        :can-join="canJoinTournament"
        :can-leave="canLeaveTournament"
        :can-create-match="canCreateMatch"
        :can-manage="canManageTournament"
        :joining="joining"
        :leaving="leaving"
        :tournament-id="tournamentId"
        :tournament-duration="tournamentDuration"
        :current-user-id="appUser?.id"
        :ranked-leaderboard="rankedLeaderboard"
        :ranked-tiers="rankedTiers"
        :player-mmr="playerMmr"
        :player-history="rankedHistory"
        :player-history-has-more="playerHistoryHasMore"
        :ranked-loading="rankedLoading"
        :app-user-id="appUser?.id"
        :leaderboard-rank="playerLeaderboardRank"
        :profile-chart-history="profileChartHistory"
        @join="joinTournament"
        @leave="leaveTournament"
        @create-match="createMatch"
        @edit="editTournament"
        @view-rules="viewRules"
        @recalculate-points="handleRecalculatePoints"
        @participant-added="handleParticipantAdded"
        @tab-change="handleRankedMobileTabChange"
      />
    </div>

    <!-- Desktop version -->
    <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <!-- Hero header -->
      <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div class="max-w-5xl mx-auto px-6 pt-5" :class="isScrolled ? 'pb-3' : 'pb-5'">
          <div class="flex items-start gap-3">
            <!-- Home button -->
            <Button
              icon="fa fa-arrow-left"
              text
              rounded
              @click="router.push('/')"
              class="shrink-0 mt-0.5! text-gray-500 dark:text-gray-400"
              v-tooltip.bottom="'Retour à l\'accueil'"
            />

            <!-- Title + badges -->
            <div class="flex-1 min-w-0">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                {{ tournament.name }}
              </h1>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <!-- Pulsing dot for ongoing -->
                <span
                  v-if="tournament.status === 'ongoing'"
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                >
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  En cours
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  :class="statusClasses[tournament.status]"
                >
                  {{ statusLabels[tournament.status] }}
                </span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold">
                  {{ modeLabels[tournament.mode] }}
                </span>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-2 shrink-0">
              <Button
                v-if="isAuthenticated && !isParticipant && canJoinTournament"
                label="Participer"
                icon="fa fa-user-plus"
                @click="joinTournament"
                :loading="joining"
                class="bg-green-600 hover:bg-green-700"
              />
              <div
                v-if="isAuthenticated && isParticipant && !canLeaveTournament"
                class="flex items-center gap-2 text-green-600 text-sm font-medium"
              >
                <i class="fa fa-check-circle"></i>
                <span>Inscrit</span>
              </div>
              <Button
                v-if="canCreateMatch"
                label="Créer un match"
                icon="fa fa-plus"
                @click="createMatch"
                class="bg-blue-600 hover:bg-blue-700"
              />
              <Button
                v-if="tournament.rulesId"
                icon="fa fa-scroll"
                v-tooltip.top="'Règles'"
                severity="secondary"
                outlined
                @click="viewRules"
              />
              <Button
                v-if="menuItems.length > 0"
                icon="fa fa-ellipsis-v"
                severity="secondary"
                outlined
                @click="menu!.toggle($event)"
                aria-haspopup="true"
                aria-controls="desktop-header-menu"
              />
              <Menu id="desktop-header-menu" ref="menu" :model="menuItems" popup />
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky tab bar -->
      <div class="sticky top-14 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div class="max-w-5xl mx-auto px-6">
          <div ref="tabBarRef" class="flex relative">
            <button
              v-for="tab in visibleTabs"
              :key="tab.value"
              :ref="(el) => setTabRef(tab.value, el)"
              @click="setActiveTab(tab.value)"
              class="px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5"
              :class="
                activeTab === tab.value
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              "
            >
              {{ tab.label }}
              <Badge v-if="tab.badge !== undefined" :value="tab.badge" severity="info" size="small" />
            </button>
            <!-- Animated sliding indicator -->
            <div
              class="absolute bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 transition-all duration-300 ease-out"
              :style="indicatorStyle"
            />
          </div>
        </div>
      </div>

      <!-- Tab content -->
      <div class="max-w-5xl mx-auto px-6 py-6">
        <!-- Infos tab -->
        <div v-show="activeTab === 'infos'" class="space-y-6">
          <div
            v-if="tournament.description"
            class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 tournament-description text-gray-700 dark:text-gray-300"
            v-html="tournament.description"
          />
          <TournamentInfoGrid
            :mode="tournament.mode"
            :team-mode="tournament.teamMode"
            :min-team-size="tournament.minTeamSize"
            :max-team-size="tournament.maxTeamSize"
            :participant-count="participantCount"
            :start-date="tournament.startDate"
            :end-date="tournament.endDate"
            :duration="tournamentDuration"
            :point-per-victory="tournament.pointPerVictory"
            :point-per-draw="tournament.pointPerDraw"
            :point-per-loss="tournament.pointPerLoss"
            :allow-draw="tournament.allowDraw"
          />
          <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div class="flex items-center gap-2 mb-4 text-base font-semibold text-gray-900 dark:text-white">
              Participants
              <Badge :value="participantCount" severity="info" size="small" />
            </div>
            <TournamentParticipantsList
              :participants="participants"
              :loading="loadingParticipants"
              :tournament-id="tournamentId"
              @participant-added="handleParticipantAdded"
            />
          </div>
          <TeamManagementPanel
            v-if="tournament.teamMode === 'static'"
            :tournament-id="tournamentId"
            :current-user-id="appUser?.id"
            :is-participant="isParticipant"
            :can-manage="canManageTournament"
            :tournament-status="tournament.status"
          />
        </div>

        <!-- Standings tab (championship) -->
        <div v-if="tournament.mode === 'championship'" v-show="activeTab === 'standings'">
          <StandingsTable
            :tournament-id="tournamentId"
            :allow-draw="tournament.allowDraw"
            :score-enabled="tournament.scoreEnabled ?? true"
            :team-mode="tournament.teamMode"
          />
        </div>

        <!-- Standings tab (ranked) -->
        <div v-if="tournament.mode === 'ranked'" v-show="activeTab === 'standings'">
          <RankedLeaderboard
            :players="rankedLeaderboard"
            :tiers="rankedTiers"
            :loading="rankedLoading"
            :current-user-id="appUser?.id"
          />
        </div>

        <!-- Mon profil tab (ranked) -->
        <div
          v-if="tournament.mode === 'ranked' && isAuthenticated && appUser"
          v-show="activeTab === 'profile'"
        >
          <PlayerMmrProfile
            v-if="playerMmr"
            :mmr="playerMmr"
            :tiers="rankedTiers"
            :leaderboard-rank="playerLeaderboardRank"
            :history="profileChartHistory"
          />
          <div v-else-if="rankedLoading" class="flex justify-center py-12">
            <ProgressSpinner />
          </div>
          <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
            <i class="fa fa-user-slash text-4xl mb-4 block"></i>
            <p>Vous n'avez pas encore de MMR pour cette saison.</p>
            <p class="text-sm mt-2">Déclarez votre premier match pour rejoindre le classement !</p>
          </div>
        </div>

        <!-- Bracket tab -->
        <div v-if="tournament.mode === 'bracket'" v-show="activeTab === 'bracket'">
          <BracketView :tournament-id="tournamentId" :tournament="tournament" />
        </div>

        <!-- Matches tab -->
        <div v-show="activeTab === 'matches'">
          <MatchList
            :tournament-id="tournamentId"
            :bracket-mode="tournament.mode === 'bracket'"
          />
        </div>

        <!-- Mon historique tab (championship / bracket) -->
        <div
          v-if="isParticipant && tournament.mode !== 'ranked'"
          v-show="activeTab === 'my-history'"
        >
          <MatchList
            :tournament-id="tournamentId"
            :player-id="appUser?.id"
            :bracket-mode="tournament.mode === 'bracket'"
          />
        </div>

        <!-- Mon historique tab (ranked) -->
        <div
          v-if="tournament.mode === 'ranked' && isAuthenticated && appUser"
          v-show="activeTab === 'my-history'"
        >
          <RankedMatchHistory
            :history="rankedHistory"
            :loading="rankedLoading"
            :has-more="playerHistoryHasMore"
            :allow-draw="tournament.allowDraw"
            :total-matches="rankedHistory.length"
            :on-load-more="loadMoreHistory"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Not found -->
  <div v-else class="tournament-detail-view">
    <Card class="text-center py-12">
      <template #content>
        <div class="space-y-4">
          <i class="pi pi-exclamation-triangle text-4xl text-orange-400"></i>
          <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Tournoi introuvable
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            Le tournoi que vous cherchez n'existe pas ou n'est plus disponible.
          </p>
          <div>
            <Button label="Retour aux tournois" @click="router.push('/')" class="text-blue-600" />
          </div>
        </div>
      </template>
    </Card>
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { useAuth } from '@/composables/useAuth'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import { useRankedService } from '@/composables/ranked/ranked.service'
import MatchList from '@/components/MatchList.vue'
import TournamentInfoGrid from '@/components/tournament/TournamentInfoGrid.vue'
import TournamentParticipantsList from '@/components/tournament/TournamentParticipantsList.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import TournamentDetailMobile from '@/components/tournament/mobile/TournamentDetailMobile.vue'
import BracketView from '@/components/bracket/BracketView.vue'
import TeamManagementPanel from '@/components/tournament/TeamManagementPanel.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import RankedMatchHistory from '@/components/ranked/RankedMatchHistory.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import { rankedApi } from '@/composables/ranked/ranked.api'
import type { ClientMmrHistoryEntry } from '@skill-arena/shared/types/index'
import { calculateDuration } from '@/utils/DateUtils'
import { useViewport } from '@/composables/useViewport'
import type Menu from 'primevue/menu'
import type { TournamentMode } from '@skill-arena/shared'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, appUser, userRole } = useAuth()
const {
  currentTournament: tournament,
  error,
  isTournamentOpenForJoin,
  canLeaveTournament: canLeaveTournamentCheck,
  canCreateMatchInTournament,
  canManageTournament: canManageTournamentCheck,
  loadTournamentWithErrorHandling,
  recalculatePoints,
} = useTournamentService()
const {
  participants,
  participantCount,
  loading: loadingParticipants,
  isUserParticipant,
  joinTournamentAndReload,
  leaveTournamentAndReload,
  getTournamentParticipants,
} = useParticipantService()
const {
  leaderboard: rankedLeaderboard,
  tiers: rankedTiers,
  playerHistory: rankedHistory,
  playerHistoryHasMore,
  playerMmr,
  loading: rankedLoading,
  loadLeaderboard,
  loadPlayerMmr,
  loadPlayerHistory,
  loadMoreHistory,
} = useRankedService()

const isInitialLoading = ref(true)
const joining = ref(false)
const leaving = ref(false)
const activeTab = ref('standings')
const { isMobile } = useViewport()
const { y: scrollY } = useWindowScroll()

// Tab bar indicator
const tabBarRef = ref<HTMLElement | null>(null)
const tabEls = ref<Record<string, HTMLElement | null>>({})
const indicatorStyle = ref({ left: '0px', width: '0px' })

const menu = ref<InstanceType<typeof Menu> | null>(null)
const profileChartHistory = ref<ClientMmrHistoryEntry[]>([])

const tournamentId = computed(() => route.params.id as string)
const isScrolled = computed(() => scrollY.value > 80)
const isParticipant = computed(() => isUserParticipant(appUser.value?.id))

const canJoinTournament = computed(
  () => isTournamentOpenForJoin(tournament.value) && appUser.value?.role !== 'kiosk',
)
const canLeaveTournament = computed(() => canLeaveTournamentCheck(tournament.value))
const canManageTournament = computed(() => {
  if (!isAuthenticated.value || !tournament.value) return false
  return canManageTournamentCheck(tournament.value)
})
const canCreateMatch = computed(() =>
  canCreateMatchInTournament(tournament.value, isAuthenticated.value, isParticipant.value, userRole.value),
)

const tournamentDuration = computed(() => {
  if (!tournament.value) return ''
  return calculateDuration(tournament.value.startDate, tournament.value.endDate)
})

const playerLeaderboardRank = computed(() => {
  if (!appUser.value || !rankedLeaderboard.value.length) return undefined
  const idx = rankedLeaderboard.value.findIndex((p) => p.player?.id === appUser.value?.id)
  return idx >= 0 ? idx + 1 : undefined
})

const menuItems = computed(() => {
  const items: { label: string; icon: string; command: () => void }[] = []
  if (canManageTournament.value) {
    items.push({ label: 'Modifier', icon: 'fa fa-pencil', command: editTournament })
    if (tournament.value?.mode !== 'ranked') {
      items.push({ label: 'Recalculer les points', icon: 'fa fa-calculator', command: handleRecalculatePoints })
    }
  }
  if (isAuthenticated.value && isParticipant.value && canLeaveTournament.value) {
    items.push({ label: 'Quitter', icon: 'fa fa-user-minus', command: leaveTournament })
  }
  return items
})

const statusClasses: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  open: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  ongoing: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  finished: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
}
const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  ongoing: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
}
const modeLabels: Record<TournamentMode, string> = {
  championship: 'Championnat',
  bracket: 'Bracket',
  ranked: 'Ranked',
}

const visibleTabs = computed(() => {
  const mode = tournament.value?.mode
  const tabs: { value: string; label: string; badge?: number }[] = [
    { value: 'infos', label: 'Infos' },
  ]
  if (mode === 'championship') tabs.push({ value: 'standings', label: 'Classement' })
  if (mode === 'bracket')      tabs.push({ value: 'bracket',   label: 'Bracket' })
  if (mode === 'ranked')       tabs.push({ value: 'standings', label: 'Classement' })
  tabs.push({ value: 'matches', label: 'Matchs' })
  if (mode === 'ranked' && isAuthenticated.value && appUser.value) {
    tabs.push({ value: 'profile',    label: 'Mon profil' })
    tabs.push({ value: 'my-history', label: 'Mon historique' })
  } else if (mode !== 'ranked' && isParticipant.value) {
    tabs.push({ value: 'my-history', label: 'Mon historique' })
  }
  return tabs
})

function setTabRef(value: string, el: unknown) {
  tabEls.value[value] = el as HTMLElement | null
}

async function updateIndicator() {
  await nextTick()
  const el = tabEls.value[activeTab.value]
  if (el) {
    indicatorStyle.value = {
      left: `${el.offsetLeft}px`,
      width: `${el.offsetWidth}px`,
    }
  }
}

function setActiveTab(value: string) {
  activeTab.value = value
}

watch(activeTab, async (tab) => {
  await router.replace({ query: { ...route.query, tab } })
  await updateIndicator()

  if (tournament.value?.mode === 'ranked') {
    if (tab === 'standings' && !rankedLeaderboard.value.length)
      await loadLeaderboard(tournamentId.value)
    if (tab === 'profile' && appUser.value?.id && !playerMmr.value) {
      await loadPlayerMmr(tournamentId.value, appUser.value.id)
      profileChartHistory.value = await rankedApi.getPlayerHistory(tournamentId.value, appUser.value.id, { limit: 200 })
    }
    if (tab === 'my-history' && appUser.value?.id && !rankedHistory.value.length)
      await loadPlayerHistory(tournamentId.value, appUser.value.id)
  }
})

watch(visibleTabs, updateIndicator)

async function loadTournament() {
  await loadTournamentWithErrorHandling(tournamentId.value)
}

async function loadParticipants() {
  await getTournamentParticipants(tournamentId.value)
}

async function joinTournament() {
  try {
    joining.value = true
    await joinTournamentAndReload(tournamentId.value)
  } catch (err) {
    console.error("Erreur lors de l'inscription:", err)
  } finally {
    joining.value = false
  }
}

async function leaveTournament() {
  try {
    leaving.value = true
    await leaveTournamentAndReload(tournamentId.value)
  } catch (err) {
    console.error('Erreur lors de la désinscription:', err)
  } finally {
    leaving.value = false
  }
}

function editTournament() {
  router.push(`/admin/tournaments/${tournamentId.value}/edit`)
}

function createMatch() {
  router.push(`/tournaments/${tournamentId.value}/create-match`)
}

async function handleRecalculatePoints() {
  await recalculatePoints(tournamentId.value)
}

function viewRules() {
  router.push(`/rules/${tournament.value?.rulesId}`)
}

async function handleParticipantAdded() {
  await loadParticipants()
}

async function handleRankedMobileTabChange(tab: string) {
  if (tab === 'profile' && appUser.value?.id && !playerMmr.value) {
    await loadPlayerMmr(tournamentId.value, appUser.value.id)
    profileChartHistory.value = await rankedApi.getPlayerHistory(tournamentId.value, appUser.value.id, { limit: 200 })
  }
  if (tab === 'history' && appUser.value?.id && !rankedHistory.value.length)
    await loadPlayerHistory(tournamentId.value, appUser.value.id)
}

onMounted(async () => {
  try {
    await loadTournament()
    if (tournament.value) {
      await loadParticipants()
      if (tournament.value.mode === 'ranked')
        await loadLeaderboard(tournamentId.value)
    }

    const tab = route.query.tab as string | undefined
    const mode = tournament.value?.mode
    const validTabs = ['infos', 'matches']
    if (mode === 'championship') validTabs.push('standings')
    if (mode === 'bracket') validTabs.push('bracket')
    if (mode === 'ranked') validTabs.push('standings', 'profile', 'my-history')
    if (mode !== 'ranked' && isParticipant.value) validTabs.push('my-history')

    if (tab && validTabs.includes(tab)) {
      activeTab.value = tab
    } else if (mode === 'bracket') {
      activeTab.value = 'bracket'
    } else {
      activeTab.value = 'standings'
    }
  } finally {
    isInitialLoading.value = false
    await updateIndicator()
  }
})
</script>

<style scoped>
.tournament-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Description rich text styles */
:deep(.tournament-description h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
:deep(.tournament-description h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
:deep(.tournament-description ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description p) {
  margin: 0.5rem 0;
}
:deep(.tournament-description strong) {
  font-weight: 700;
}
:deep(.tournament-description em) {
  font-style: italic;
}
:deep(.tournament-description u) {
  text-decoration: underline;
}
:deep(.tournament-description a) {
  color: rgb(59 130 246);
  text-decoration: underline;
}

/* Description fade transition */
.desc-fade-enter-active,
.desc-fade-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
  max-height: 300px;
}
.desc-fade-enter-from,
.desc-fade-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
