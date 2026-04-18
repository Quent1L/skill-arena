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
      <!-- Tab: Detail & Navigation cards -->
      <div v-show="activeTab === 'participants'" class="space-y-4 p-4">
        <TournamentHeader
          :name="store.tournament!.name"
          :description="store.tournament!.description"
          :status="store.tournament!.status"
          :mode="store.tournament!.mode"
          :is-authenticated="store.isAuthenticated"
          :is-participant="store.isParticipant"
          :can-join="store.canJoinTournament"
          :can-leave="store.canLeaveTournament"
          :can-create-match="false"
          :can-manage="store.canManageTournament"
          :joining="store.joining"
          :leaving="store.leaving"
          :rules-id="store.tournament!.rulesId"
          @join="store.joinTournament()"
          @leave="store.leaveTournament()"
          @create-match="router.push(`/tournaments/${store.tournamentId}/create-match`)"
          @edit="router.push(`/admin/tournaments/${store.tournamentId}/edit`)"
          @view-rules="router.push(`/rules/${store.tournament!.rulesId}`)"
        />

        <div class="space-y-3">
          <!-- Participants -->
          <button
            @click="
              router.push({
                name: 'tournament-tab',
                params: { id: store.tournamentId, tab: 'participants' },
              })
            "
            class="group w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-transform text-left"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0"
              >
                <i class="fa fa-users text-blue-600 dark:text-blue-400 text-sm" />
              </div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white text-sm">Participants</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  Voir les joueurs inscrits
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Badge :value="store.participantCount" severity="info" size="small" />
              <i class="fa fa-chevron-right text-gray-400 text-xs" />
            </div>
          </button>

          <!-- Équipes (static uniquement) -->
          <button
            v-if="store.tournament!.teamMode === 'static'"
            @click="
              router.push({
                name: 'tournament-tab',
                params: { id: store.tournamentId, tab: 'teams' },
              })
            "
            class="group w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-transform text-left"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0"
              >
                <i class="fa fa-shield-halved text-green-600 dark:text-green-400 text-sm" />
              </div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white text-sm">Équipes</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Gérer les équipes</div>
              </div>
            </div>
            <i class="fa fa-chevron-right text-gray-400 text-xs shrink-0" />
          </button>

          <!-- Stats globale -->
          <button
            @click="
              router.push({
                name: 'tournament-tab',
                params: { id: store.tournamentId, tab: 'stats' },
              })
            "
            class="group w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-transform text-left"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"
              >
                <i class="fa fa-chart-pie text-indigo-600 dark:text-indigo-400 text-sm" />
              </div>
              <div>
                <div class="font-semibold text-gray-900 dark:text-white text-sm">Stats globale</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Statistiques du tournoi</div>
              </div>
            </div>
            <i class="fa fa-chevron-right text-gray-400 text-xs shrink-0" />
          </button>
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
          v-model:standings-type="standingsType"
        />
      </div>

      <!-- Tab: Bracket -->
      <div
        v-if="store.tournament!.mode === 'bracket'"
        v-show="activeTab === 'bracket'"
        class="h-full p-2"
      >
        <BracketView :tournament-id="store.tournamentId" :tournament="store.tournament!" />
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
          :tiers="store.rankedTiers"
          :loading="store.rankedLoading"
          :current-user-id="store.appUser?.id"
        />
      </div>

      <!-- Tab: Mon profil (ranked) -->
      <div v-if="store.tournament!.mode === 'ranked'" v-show="activeTab === 'profile'" class="p-2">
        <PlayerMmrProfile
          v-if="store.playerMmr"
          :mmr="store.playerMmr"
          :tiers="store.rankedTiers"
          :leaderboard-rank="store.playerLeaderboardRank"
          :history="store.profileChartHistory"
        />
        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
          <i class="fa fa-user-slash text-4xl mb-4 block"></i>
          <p>Vous n'avez pas encore de MMR pour cette saison.</p>
          <p class="text-sm mt-2">Déclarez votre premier match pour rejoindre le classement !</p>
        </div>
      </div>

    </div>

    <!-- Speed Dial for Create Match -->
    <div v-if="activeTab === 'matches' && store.canCreateMatch">
      <SpeedDial
        @click="router.push(`/tournaments/${store.tournamentId}/create-match`)"
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
      <template v-if="store.tournament!.mode === 'ranked'">
        <button
          @click="activeTab = 'participants'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'participants' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'participants' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-info-circle text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'participants' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Détail</span>
        </button>

        <button
          @click="activeTab = 'standings'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'standings' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'standings' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-trophy text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'standings' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Classement</span>
        </button>

        <button
          v-if="store.isAuthenticated"
          @click="switchTab('profile')"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'profile' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'profile' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-user text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'profile' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Profil</span>
        </button>

        <button
          @click="activeTab = 'matches'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'matches' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'matches' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-gamepad text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'matches' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
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
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'participants' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-info-circle text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'participants' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Info</span>
        </button>

        <button
          v-if="store.tournament!.mode !== 'bracket'"
          @click="activeTab = 'standings'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'standings' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'standings' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-trophy text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'standings' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Classement</span>
        </button>

        <button
          v-if="store.tournament!.mode === 'bracket'"
          @click="activeTab = 'bracket'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'bracket' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'bracket' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-sitemap text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'bracket' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Bracket</span>
        </button>

        <button
          @click="activeTab = 'matches'"
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="activeTab === 'matches' ? activeNavClass : inactiveNavClass"
        >
          <div
            class="absolute top-0 left-0 right-0 h-0.5 transition-colors duration-200"
            :class="
              activeTab === 'matches' ? 'bg-primary-600 dark:bg-primary-400' : 'bg-transparent'
            "
          ></div>
          <i
            class="fas fa-gamepad text-xl mb-1 transition-transform duration-200"
            :class="activeTab === 'matches' ? 'scale-110' : 'group-hover:scale-105'"
          ></i>
          <span class="text-xs font-medium">Matchs</span>
        </button>

        <button
          v-if="store.tournament!.teamMode === 'static'"
          @click="
            router.push({
              name: 'tournament-tab',
              params: { id: store.tournamentId, tab: 'teams' },
            })
          "
          class="flex flex-col items-center justify-center w-full h-full transition-all duration-200 relative group"
          :class="inactiveNavClass"
        >
          <div class="absolute top-0 left-0 right-0 h-0.5 bg-transparent"></div>
          <i
            class="fas fa-users text-xl mb-1 transition-transform duration-200 group-hover:scale-105"
          ></i>
          <span class="text-xs font-medium">Équipes</span>
        </button>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSwipe } from '@vueuse/core'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import BracketView from '@/components/bracket/BracketView.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'

const router = useRouter()
const store = useTournamentDetailStore()

const contentAreaRef = ref<HTMLElement | null>(null)
const standingsType = ref<'official' | 'provisional'>('official')
const standingsTypeValues = ['official', 'provisional'] as const

const activeNavClass =
  'text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/20'
const inactiveNavClass =
  'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'

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

async function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'profile') await store.ensurePlayerProfile()
}

onMounted(() => {
  if (store.tournament?.mode === 'ranked') {
    activeTab.value = 'standings'
  }
})
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(4rem + env(safe-area-inset-bottom));
}
</style>
