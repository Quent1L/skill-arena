<template>
  <div
    class="flex flex-col h-full bg-gray-50 dark:bg-gray-900"
    style="min-height: calc(100vh - 7rem)"
  >
    <!-- Content Area -->
    <div ref="contentAreaRef" class="flex-1 pb-16">
      <!-- Tab: Detail & Navigation cards -->
      <div v-show="activeTab === 'infos'" class="space-y-4 p-4">
        <TournamentHeader
          :name="store.tournament!.name"
          :status="store.tournament!.status"
          :mode="store.tournament!.mode"
          :is-authenticated="store.isAuthenticated"
          :is-participant="store.isParticipant"
          :can-join="store.canJoinTournament"
          :can-leave="store.canLeaveTournament"
          :can-create-match="false"
          :items="store.menuItems"
          :joining="store.joining"
          :leaving="store.leaving"
          @join="store.joinTournament()"
          @leave="store.leaveTournament()"
        />

        <TournamentInfosTab />
      </div>

      <!-- Tab: Participants -->
      <div v-show="activeTab === 'participants'" class="h-full p-4">
        <TournamentParticipantsTab />
      </div>

      <!-- Tab: Stats -->
      <div v-show="activeTab === 'stats'" class="h-full">
        <!-- Sub-tab switcher: ranked + authenticated only -->
        <div
          v-if="store.tournament!.mode === 'ranked' && store.isAuthenticated"
          class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <button
            class="flex-1 py-2 text-sm font-semibold transition-colors"
            :class="
              statsSubTab === 'profile'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-500'
            "
            @click="setStatsSubTab('profile')"
          >
            Mon profil
          </button>
          <button
            class="flex-1 py-2 text-sm font-semibold transition-colors"
            :class="
              statsSubTab === 'global'
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-gray-500'
            "
            @click="setStatsSubTab('global')"
          >
            Stats globales
          </button>
        </div>

        <!-- Animated content (ranked + auth) -->
        <div
          v-if="store.tournament!.mode === 'ranked' && store.isAuthenticated"
          class="relative overflow-hidden"
        >
          <Transition :name="statsSwipeTransition" mode="out-in">
            <div v-if="statsSubTab === 'profile'" key="profile" class="p-2">
              <PlayerMmrProfile
                v-if="store.playerMmr"
                :mmr="store.playerMmr"
                :tiers="store.rankedTiers"
                :leaderboard-rank="store.playerLeaderboardRank"
                :history="store.profileChartHistory"
                :opponent-quality="store.playerOpponentQuality"
                :recent-form="store.playerStats?.stats?.recentForm"
                :most-frequent-partners="store.playerStats?.stats?.mostFrequentPartners"
                :best-partners="store.playerStats?.stats?.bestPartners"
                :nemeses="store.playerStats?.stats?.nemeses"
              />
              <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
                <i class="fa fa-user-slash text-4xl mb-4 block"></i>
                <p>Vous n'avez pas encore de MMR pour cette saison.</p>
                <p class="text-sm mt-2">
                  Déclarez votre premier match pour rejoindre le classement !
                </p>
              </div>
            </div>
            <div v-else key="global" class="p-2">
              <TournamentStatsTab />
            </div>
          </Transition>
        </div>

        <!-- Non-ranked / unauthenticated -->
        <div v-else class="p-2">
          <TournamentStatsTab />
        </div>
      </div>

      <!-- Tab: Standings (championship only) -->
      <div
        v-if="store.tournament!.mode === 'championship'"
        v-show="activeTab === 'standings'"
        class="h-full p-2"
      >
        <StandingsTable
          class="h-full"
          :tournament-id="store.tournamentId"
          :allow-draw="store.tournament!.allowDraw"
          :score-enabled="store.tournament!.scoreEnabled ?? true"
          :team-mode="store.tournament!.teamMode"
          :show-provisional-toggle="store.tournament!.validationMode !== 'none'"
          :tournament-config="{
            pointPerVictory: store.tournament!.pointPerVictory,
            pointPerDraw: store.tournament!.pointPerDraw,
            pointPerLoss: store.tournament!.pointPerLoss,
            maxMatchesPerPlayer: store.tournament!.maxMatchesPerPlayer,
            maxTimesWithSamePartner: store.tournament!.maxTimesWithSamePartner,
            maxTimesWithSameOpponent: store.tournament!.maxTimesWithSameOpponent,
            minTeamSize: store.tournament!.minTeamSize,
            maxTeamSize: store.tournament!.maxTeamSize,
            minScore: store.tournament!.minScore,
            maxScore: store.tournament!.maxScore,
            disciplineId: store.tournament!.disciplineId,
          }"
          v-model:standings-type="standingsType"
        />
      </div>

      <!-- Tab: Bracket -->
      <div v-if="store.tournament!.mode === 'bracket'" v-show="activeTab === 'bracket'" class="p-2">
        <BracketView
          :tournament-id="store.tournamentId"
          :tournament="store.tournament!"
          style="--bracket-sticky-top: 0rem"
        />
      </div>

      <!-- Tab: Matches -->
      <div v-show="activeTab === 'matches'" class="h-full p-2">
        <MatchList
          :tournament-id="store.tournamentId"
          :bracket-mode="store.tournament!.mode === 'bracket'"
          :players="
            store.participants.map((p) => ({ id: p.userId, displayName: p.user.displayName }))
          "
          :current-player-id="store.appUser?.id"
          :allow-draw="store.tournament!.allowDraw"
        />
      </div>

      <!-- Tab: Ranked leaderboard -->
      <div
        v-if="store.tournament!.mode === 'ranked'"
        v-show="activeTab === 'standings'"
        class="p-2"
      >
        <RankedLeaderboard
          :players="store.rankedLeaderboard"
          :provisional-players="store.rankedProvisionalLeaderboard"
          :tiers="store.rankedTiers"
          :loading="store.rankedLoading"
          :provisional-loading="store.rankedProvisionalLoading"
          :current-user-id="store.appUser?.id"
          :show-mode-toggle="store.tournament!.validationMode !== 'none'"
          :tournament-id="store.tournamentId"
          @load-provisional="store.loadProvisionalLeaderboard()"
        />
      </div>
    </div>

    <!-- Bottom Navigation -->
    <MobileBottomNav
      :active-tab="activeTab"
      :tournament-mode="store.tournament!.mode"
      :team-mode="store.tournament!.teamMode"
      :is-authenticated="store.isAuthenticated"
      :can-create-match="store.canCreateMatch"
      @navigate="handleNavigate"
      @create-match="handleCreateMatch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSwipe } from '@vueuse/core'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import BracketView from '@/components/bracket/BracketView.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import TournamentParticipantsTab from '@/views/tournament/tabs/TournamentParticipantsTab.vue'
import TournamentStatsTab from '@/views/tournament/tabs/TournamentStatsTab.vue'
import TournamentInfosTab from '@/views/tournament/tabs/TournamentInfosTab.vue'
import MobileBottomNav from '@/components/tournament/mobile/MobileBottomNav.vue'

const route = useRoute()
const router = useRouter()
const store = useTournamentDetailStore()

const contentAreaRef = ref<HTMLElement | null>(null)
const standingsType = ref<'official' | 'provisional'>('official')
const statsSubTab = ref<'profile' | 'global'>('profile')
const standingsTypeValues = ['official', 'provisional'] as const

useSwipe(contentAreaRef, {
  onSwipeEnd(_e, direction) {
    if (activeTab.value === 'standings') {
      const currentIndex = standingsTypeValues.indexOf(standingsType.value)
      const next = standingsTypeValues[currentIndex + 1]
      const prev = standingsTypeValues[currentIndex - 1]
      if (direction === 'left' && next) standingsType.value = next
      else if (direction === 'right' && prev) standingsType.value = prev
    } else if (
      activeTab.value === 'stats' &&
      store.tournament?.mode === 'ranked' &&
      store.isAuthenticated
    ) {
      const currentIndex = statsSubTabValues.indexOf(statsSubTab.value)
      const next = statsSubTabValues[currentIndex + 1]
      const prev = statsSubTabValues[currentIndex - 1]
      if (direction === 'left' && next) {
        statsSwipeTransition.value = 'slide-left'
        statsSubTab.value = next
      } else if (direction === 'right' && prev) {
        statsSwipeTransition.value = 'slide-right'
        statsSubTab.value = prev
      }
    }
  },
})

const activeTab = computed(() => (route.params.tab as string) || 'infos')

const statsSubTabValues = ['profile', 'global'] as const
const statsSwipeTransition = ref<'slide-left' | 'slide-right'>('slide-left')

function setStatsSubTab(tab: 'profile' | 'global') {
  const from = statsSubTabValues.indexOf(statsSubTab.value)
  const to = statsSubTabValues.indexOf(tab)
  statsSwipeTransition.value = to > from ? 'slide-left' : 'slide-right'
  statsSubTab.value = tab
}

function navigate(tab: string) {
  router.push({ name: 'tournament-tab', params: { id: store.tournamentId, tab } })
}

async function handleNavigate(tab: string) {
  navigate(tab)
  if (tab === 'stats' && store.tournament?.mode === 'ranked') await store.ensurePlayerProfile()
}

function handleCreateMatch() {
  router.push(`/tournaments/${store.tournamentId}/create-match`)
}
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.22s ease,
    opacity 0.18s ease;
}

.slide-left-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-right-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(40px);
  opacity: 0;
}
</style>
