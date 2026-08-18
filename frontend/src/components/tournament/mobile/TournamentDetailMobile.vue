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

      <!--
        Tab: Stats. No `h-full` here: a sticky child only sticks within its parent's box,
        and a height capped to the viewport would drop the switcher after one screen.
      -->
      <div v-show="activeTab === 'stats'">
        <!-- Sub-tabs: ranked + authenticated only. Mounted from the first visit onwards. -->
        <template v-if="hasStatsSubTabs">
          <SubTabTrack
            v-if="statsTabVisited"
            :options="statsSubTabs"
            :model-value="statsSubTab"
            :enabled="statsDragEnabled"
            :scroll-root="contentAreaRef"
            @update:model-value="setStatsSubTab"
          >
            <template #profile>
              <MobileRankedProfilePane />
            </template>
            <template #global>
              <TournamentStatsTab />
            </template>
          </SubTabTrack>
        </template>

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
          :tournament-config="toStandingsConfig(store.tournament!)"
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
          :show-disputed-filter="store.canManageTournament"
        />
      </div>

      <!-- Tab: Ranked leaderboard. Padding is left to the leaderboard itself: the
           switchable views need it inside each pane, so that two of them never touch
           while the finger drags between them. -->
      <div v-if="store.tournament!.mode === 'ranked'" v-show="activeTab === 'standings'">
        <RankedLeaderboard
          :players="store.rankedLeaderboard"
          :provisional-players="store.rankedProvisionalLeaderboard"
          :season-mmr-players="store.rankedSeasonMmrLeaderboard"
          :tiers="store.rankedTiers"
          :placement-matches="store.rankedPlacementMatches"
          :loading="store.rankedLoading"
          :provisional-loading="store.rankedProvisionalLoading"
          :season-mmr-loading="store.rankedSeasonMmrLoading"
          :is-recalculating="store.isLeaderboardRecalculating"
          :current-user-id="store.appUser?.id"
          :show-mode-toggle="store.tournament!.validationMode !== 'none'"
          :show-season-stats="store.tournament!.status === 'finished'"
          :tournament-id="store.tournamentId"
          @load-provisional="store.loadProvisionalLeaderboard()"
          @load-season-stats="store.loadSeasonMmrLeaderboard()"
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
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSwipe } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import { useSubTabs } from '@/composables/ui/useSubTabs'
import SubTabTrack from '@/components/ui/SubTabTrack.vue'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
import { toStandingsConfig } from '@/utils/standings-config'
import BracketView from '@/components/bracket/BracketView.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import TournamentParticipantsTab from '@/views/tournament/tabs/TournamentParticipantsTab.vue'
import TournamentStatsTab from '@/views/tournament/tabs/TournamentStatsTab.vue'
import TournamentInfosTab from '@/views/tournament/tabs/TournamentInfosTab.vue'
import MobileBottomNav from '@/components/tournament/mobile/MobileBottomNav.vue'
import MobileRankedProfilePane from '@/components/tournament/mobile/MobileRankedProfilePane.vue'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const store = useTournamentDetailStore()

const contentAreaRef = ref<HTMLElement | null>(null)
const standingsType = ref<'official' | 'provisional'>('official')
const standingsTypeValues = ['official', 'provisional'] as const
/** Standings has no live drag, so it requires a deliberate swipe. */
const STANDINGS_SWIPE_PX = 50

const activeTab = computed(() => (route.params.tab as string) || 'infos')

watch(
  () => activeTab.value === 'stats' && store.tournament?.mode === 'ranked',
  async (shouldLoad) => {
    if (shouldLoad) await store.ensurePlayerProfile()
  },
  { immediate: true },
)

const hasStatsSubTabs = computed(
  () => store.tournament?.mode === 'ranked' && store.isAuthenticated,
)

const statsSubTabs = computed(() => [
  { value: 'profile' as const, label: t('tournamentDetailMobile.myProfile') },
  { value: 'global' as const, label: t('tournamentDetailMobile.globalStats') },
])

const { active: statsSubTab, setActive: setStatsSubTab } = useSubTabs({
  options: statsSubTabs,
  queryKey: 'statsSub',
})

/** Keeps the two stats panes out of the DOM until the Stats tab is opened once. */
const statsTabVisited = ref(false)
watch(
  () => activeTab.value === 'stats',
  (isStats) => {
    if (isStats) statsTabVisited.value = true
  },
  { immediate: true },
)

// The track stays mounted under the other tabs, where its gestures mean nothing.
const statsDragEnabled = computed(() => activeTab.value === 'stats')

/**
 * Standings is the only tab left with a swipe of its own: it toggles between the official
 * and provisional tables. The stats sub-tabs handle their own gestures inside `SubTabTrack`.
 */
function swipeDirection(): 'left' | 'right' | null {
  const dx = lengthX.value
  if (Math.abs(dx) < STANDINGS_SWIPE_PX || Math.abs(dx) <= Math.abs(lengthY.value)) return null
  return dx > 0 ? 'left' : 'right'
}

const { lengthX, lengthY } = useSwipe(contentAreaRef, {
  onSwipeEnd() {
    // A ranked season also lives on the `standings` tab, with its own switchable views.
    if (activeTab.value !== 'standings' || store.tournament?.mode !== 'championship') return

    const direction = swipeDirection()
    const currentIndex = standingsTypeValues.indexOf(standingsType.value)
    const next = standingsTypeValues[currentIndex + 1]
    const prev = standingsTypeValues[currentIndex - 1]
    if (direction === 'left' && next) standingsType.value = next
    else if (direction === 'right' && prev) standingsType.value = prev
  },
})

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

