<template>
  <div
    class="flex flex-col h-full bg-gray-50 dark:bg-gray-900"
    style="min-height: calc(100vh - 7rem)"
  >
    <!-- Mobile Header -->
    <div
      class="top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 shadow-sm"
    >
      <Button
        icon="fa fa-arrow-left"
        text
        rounded
        @click="router.push('/')"
        class="mr-2 !w-10 !h-10 text-gray-700 dark:text-gray-200"
      />
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
        {{ tabTitles[activeTab] }}
      </h1>
    </div>

    <!-- Content Area -->
    <div ref="contentAreaRef" class="flex-1 overflow-y-auto pb-24">
      <!-- Tab: Detail & Participants -->
      <div v-show="activeTab === 'participants'" class="space-y-4 p-4">
        <TournamentHeader
          :name="tournament.name"
          :description="tournament.description"
          :status="tournament.status"
          :mode="tournament.mode"
          :is-authenticated="isAuthenticated"
          :is-participant="isParticipant"
          :can-join="canJoin"
          :can-leave="canLeave"
          :can-create-match="false"
          :can-manage="canManage"
          :joining="joining"
          :leaving="leaving"
          :rules-id="tournament.rulesId"
          @join="$emit('join')"
          @leave="$emit('leave')"
          @create-match="$emit('create-match')"
          @edit="$emit('edit')"
          @view-rules="$emit('view-rules')"
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

        <div class="mt-4">
          <div class="flex items-center text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Participants
            <Badge class="ml-2" :value="participantCount" severity="info" size="small" />
          </div>
          <TournamentParticipantsList
            :participants="participants"
            :loading="loadingParticipants"
            :tournament-id="tournamentId"
            @participant-added="$emit('participant-added')"
          />
        </div>
      </div>

      <!-- Tab: Standings (championship only) -->
      <div
        v-if="tournament.mode === 'championship'"
        v-show="activeTab === 'standings'"
        class="h-full p-2"
      >
        <StandingsTable
          class="h-full"
          :tournament-id="tournamentId"
          :allow-draw="tournament.allowDraw"
          :score-enabled="tournament.scoreEnabled ?? true"
          :team-mode="tournament.teamMode"
          v-model:standings-type="standingsType"
        />
      </div>

      <!-- Tab: Bracket -->
      <div v-if="tournament.mode === 'bracket'" v-show="activeTab === 'bracket'" class="h-full p-2">
        <BracketView :tournament-id="tournamentId" :tournament="tournament" />
      </div>

      <!-- Tab: Matches -->
      <div v-show="activeTab === 'matches'" class="h-full p-2">
        <MatchList :tournament-id="tournamentId" :bracket-mode="tournament.mode === 'bracket'" />
      </div>

      <!-- Tab: Teams (static mode only) -->
      <div v-if="tournament.teamMode === 'static'" v-show="activeTab === 'teams'" class="h-full">
        <TeamManagementPanel
          :tournament-id="tournamentId"
          :current-user-id="currentUserId"
          :is-participant="isParticipant"
          :can-manage="canManage"
          :tournament-status="tournament.status"
        />
      </div>

      <!-- Tab: Ranked leaderboard -->
      <div v-if="tournament.mode === 'ranked'" v-show="activeTab === 'standings'" class="p-2">
        <RankedLeaderboard
          :players="rankedLeaderboard ?? []"
          :tiers="rankedTiers ?? []"
          :loading="rankedLoading"
          :current-user-id="appUserId"
        />
      </div>

      <!-- Tab: Mon profil (ranked) -->
      <div v-if="tournament.mode === 'ranked'" v-show="activeTab === 'profile'" class="p-2">
        <PlayerMmrProfile
          v-if="playerMmr"
          :mmr="playerMmr"
          :tiers="rankedTiers ?? []"
          :leaderboard-rank="leaderboardRank"
          :history="profileChartHistory ?? []"
        />
        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
          <i class="fa fa-user-slash text-4xl mb-4 block"></i>
          <p>Vous n'avez pas encore de MMR pour cette saison.</p>
          <p class="text-sm mt-2">Déclarez votre premier match pour rejoindre le classement !</p>
        </div>
      </div>

      <!-- Tab: Mon historique (tous modes) -->
      <div v-show="activeTab === 'history'" class="p-2">
        <PlayerMatchHistory
          :history="playerHistory ?? []"
          :loading="rankedLoading"
          :has-more="playerHistoryHasMore ?? false"
          :on-load-more="() => emit('tab-change', 'history')"
        />
      </div>
    </div>

    <!-- Speed Dial for Create Match -->
    <div v-if="activeTab === 'matches' && canCreateMatch">
      <SpeedDial
        @click="$emit('create-match')"
        :radius="120"
        style="position: fixed; bottom: 5rem; right: 1rem"
        showIcon="fa fa-plus"
        hide-icon="fa fa-plus"
        buttonClass="p-button-rounded p-button-primary shadow-lg !w-14 !h-14"
      />
    </div>

    <!-- Bottom Navigation -->
    <div
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
    >
      <!-- Ranked bottom nav -->
      <template v-if="tournament.mode === 'ranked'">
        <button
          @click="activeTab = 'participants'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'participants' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'participants' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-info-circle text-xl mb-1 transition-transform duration-200" :class="activeTab === 'participants' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Détail</span>
        </button>

        <button
          @click="activeTab = 'standings'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'standings' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'standings' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-trophy text-xl mb-1 transition-transform duration-200" :class="activeTab === 'standings' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Classement</span>
        </button>

        <button
          v-if="isAuthenticated"
          @click="activeTab = 'profile'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'profile' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'profile' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-user text-xl mb-1 transition-transform duration-200" :class="activeTab === 'profile' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Profil</span>
        </button>

        <button
          v-if="isAuthenticated"
          @click="activeTab = 'history'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'history' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'history' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-clock-rotate-left text-xl mb-1 transition-transform duration-200" :class="activeTab === 'history' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Historique</span>
        </button>

        <button
          @click="activeTab = 'matches'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'matches' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'matches' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-gamepad text-xl mb-1 transition-transform duration-200" :class="activeTab === 'matches' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Matchs</span>
        </button>
      </template>

      <!-- Championship / Bracket bottom nav -->
      <template v-else>
        <button
          @click="activeTab = 'participants'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'participants' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'participants' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-info-circle text-xl mb-1 transition-transform duration-200" :class="activeTab === 'participants' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Détail</span>
        </button>

        <button
          v-if="tournament.mode !== 'bracket'"
          @click="activeTab = 'standings'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'standings' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'standings' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-trophy text-xl mb-1 transition-transform duration-200" :class="activeTab === 'standings' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Classement</span>
        </button>

        <button
          v-if="tournament.mode === 'bracket'"
          @click="activeTab = 'bracket'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'bracket' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'bracket' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-sitemap text-xl mb-1 transition-transform duration-200" :class="activeTab === 'bracket' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Bracket</span>
        </button>

        <button
          @click="activeTab = 'matches'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'matches' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'matches' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-gamepad text-xl mb-1 transition-transform duration-200" :class="activeTab === 'matches' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Matchs</span>
        </button>

        <button
          v-if="tournament.teamMode === 'static'"
          @click="activeTab = 'teams'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'teams' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'teams' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-users text-xl mb-1 transition-transform duration-200" :class="activeTab === 'teams' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Équipes</span>
        </button>

        <button
          v-if="isAuthenticated && isParticipant"
          @click="() => { activeTab = 'history'; emit('tab-change', 'history') }"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'history' ? activeNavClass : inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200" :class="activeTab === 'history' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'"></div>
          <i class="fas fa-clock-rotate-left text-xl mb-1 transition-transform duration-200" :class="activeTab === 'history' ? 'scale-110' : 'group-hover:scale-105'"></i>
          <span class="text-xs font-medium">Historique</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSwipe } from '@vueuse/core'
import type {
  ClientBaseTournament,
  ParticipantListItem,
  ClientPlayerMmr,
  ClientRankTier,
  ClientMmrHistoryEntry,
  ClientMatchHistoryEntry,
} from '@skill-arena/shared/types/index'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import TournamentInfoGrid from '@/components/tournament/TournamentInfoGrid.vue'
import TournamentParticipantsList from '@/components/tournament/TournamentParticipantsList.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import BracketView from '@/components/bracket/BracketView.vue'
import TeamManagementPanel from '@/components/tournament/TeamManagementPanel.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import PlayerMatchHistory from '@/components/match/PlayerMatchHistory.vue'

const route = useRoute()
const router = useRouter()

const props = defineProps<{
  tournament: ClientBaseTournament
  participants: ParticipantListItem[]
  participantCount: number
  loadingParticipants: boolean
  isAuthenticated: boolean
  isParticipant: boolean
  canJoin: boolean
  canLeave: boolean
  canCreateMatch: boolean
  canManage: boolean
  joining: boolean
  leaving: boolean
  tournamentId: string
  tournamentDuration: string
  currentUserId?: string
  // Ranked-specific (optional)
  rankedLeaderboard?: ClientPlayerMmr[]
  rankedTiers?: ClientRankTier[]
  playerMmr?: ClientPlayerMmr | null
  playerHistory?: ClientMatchHistoryEntry[]
  playerHistoryHasMore?: boolean
  rankedLoading?: boolean
  appUserId?: string
  leaderboardRank?: number
  profileChartHistory?: ClientMmrHistoryEntry[]
}>()

const emit = defineEmits<{
  (e: 'join'): void
  (e: 'leave'): void
  (e: 'create-match'): void
  (e: 'edit'): void
  (e: 'participant-added'): void
  (e: 'view-rules'): void
  (e: 'recalculate-points'): void
  (e: 'tab-change', tab: string): void
}>()

const contentAreaRef = ref<HTMLElement | null>(null)
const standingsType = ref<'official' | 'provisional'>('official')
const standingsTypeValues = ['official', 'provisional'] as const

const activeNavClass = 'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
const inactiveNavClass = 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'

useSwipe(contentAreaRef, {
  onSwipeEnd(_e, direction) {
    if (activeTab.value !== 'standings') return
    const currentIndex = standingsTypeValues.indexOf(standingsType.value)
    const next = standingsTypeValues[currentIndex + 1]
    const prev = standingsTypeValues[currentIndex - 1]
    if (direction === 'left' && next) standingsType.value = next
    else if (direction === 'right' && prev) standingsType.value = prev
  },
})

const activeTab = ref('participants')

const tabTitles: Record<string, string> = {
  participants: 'Détail du tournoi',
  standings: 'Classement',
  bracket: 'Bracket',
  matches: 'Matchs',
  teams: 'Équipes',
  profile: 'Mon profil',
  history: 'Mon historique',
}

onMounted(() => {
  const tab = route.query.tab as string | undefined
  if (tab) {
    const validTabs = ['participants', 'matches']
    if (props.tournament.mode === 'ranked') {
      validTabs.push('standings', 'profile', 'history')
    } else {
      if (props.tournament.mode !== 'bracket') validTabs.push('standings')
      if (props.tournament.mode === 'bracket') validTabs.push('bracket')
      if (props.tournament.teamMode === 'static') validTabs.push('teams')
    }
    if (validTabs.includes(tab)) activeTab.value = tab
  } else if (props.tournament.mode === 'ranked') {
    activeTab.value = 'standings'
  }
})

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
  if (props.tournament.mode === 'ranked') emit('tab-change', tab)
})
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(4rem + env(safe-area-inset-bottom));
}
</style>
