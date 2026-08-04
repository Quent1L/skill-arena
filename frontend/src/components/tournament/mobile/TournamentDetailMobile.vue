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
        <!--
          Sub-tab switcher: ranked + authenticated only. Sticks to the top of the viewport
          on its own, without the tournament header, so the panes can be scrolled while
          staying one tap away from each other. `top-0` is enough because AppHeader scrolls
          away with the page rather than being fixed.
        -->
        <div
          v-if="store.tournament!.mode === 'ranked' && store.isAuthenticated"
          class="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 px-3 py-2"
        >
          <div
            role="tablist"
            class="relative flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm"
          >
            <!--
              One pill shared by both tabs rather than a background per button, so it can
              travel continuously with the drag instead of jumping once the swipe commits.
              Its offset and the label colours are written by `applyStatsVisuals` rather
              than bound: they change on every touchmove, and re-rendering a template this
              size at touch frequency is what made swiping stutter.
            -->
            <span
              ref="statsPillRef"
              class="stats-synced stats-synced-transform absolute top-1 bottom-1 left-1 rounded-lg bg-primary-500 shadow-md"
              :style="{ width: `calc((100% - 0.5rem) / ${statsSubTabValues.length})` }"
            />
            <button
              ref="profileLabelRef"
              role="tab"
              :aria-selected="statsSubTab === 'profile'"
              class="stats-synced stats-synced-color relative flex-1 h-9 text-xs font-semibold uppercase tracking-wide [--stats-idle:var(--color-gray-500)] dark:[--stats-idle:var(--color-gray-400)]"
              @click="setStatsSubTab('profile')"
            >
              {{ t('tournamentDetailMobile.myProfile') }}
            </button>
            <button
              ref="globalLabelRef"
              role="tab"
              :aria-selected="statsSubTab === 'global'"
              class="stats-synced stats-synced-color relative flex-1 h-9 text-xs font-semibold uppercase tracking-wide [--stats-idle:var(--color-gray-500)] dark:[--stats-idle:var(--color-gray-400)]"
              @click="setStatsSubTab('global')"
            >
              {{ t('tournamentDetailMobile.globalStats') }}
            </button>
          </div>
        </div>

        <!-- Animated content (ranked + auth) -->
        <div
          v-if="store.tournament!.mode === 'ranked' && store.isAuthenticated"
          class="relative overflow-hidden"
        >
          <!--
            Both panes stay mounted side by side in a flex track, so the finger can drag
            the track directly and the Chart.js canvases they embed are never rebuilt.
            Mounting is deferred until the Stats tab is opened once.
          -->
          <div
            v-if="statsTabVisited"
            ref="statsTrackRef"
            class="stats-synced stats-synced-transform flex"
          >
            <!--
              The idle pane is collapsed to zero height so the page scrolls to the
              active pane, not to the taller of the two. It is re-expanded for the
              whole drag *and* for the settle animation that follows it. The inner
              wrapper is never collapsed, so it can be measured at any time, and it
              carries the scroll-alignment shift (see `measureStatsPaneShifts`).
            -->
            <div
              class="w-full shrink-0"
              :class="{ 'max-h-0 overflow-hidden': !bothStatsPanesVisible && statsSubTab !== 'profile' }"
              :aria-hidden="statsSubTab !== 'profile'"
              :inert="statsSubTab !== 'profile'"
            >
              <div
                ref="profilePaneRef"
                class="p-2"
                :style="{ transform: `translateY(${statsPaneShifts.profile}px)` }"
              >
                <MobileRankedProfilePane />
              </div>
            </div>
            <div
              class="w-full shrink-0"
              :class="{ 'max-h-0 overflow-hidden': !bothStatsPanesVisible && statsSubTab !== 'global' }"
              :aria-hidden="statsSubTab !== 'global'"
              :inert="statsSubTab !== 'global'"
            >
              <div
                ref="globalPaneRef"
                class="p-2"
                :style="{ transform: `translateY(${statsPaneShifts.global}px)` }"
              >
                <TournamentStatsTab />
              </div>
            </div>
          </div>
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
          :season-mmr-players="store.rankedSeasonMmrLeaderboard"
          :tiers="store.rankedTiers"
          :loading="store.rankedLoading"
          :provisional-loading="store.rankedProvisionalLoading"
          :season-mmr-loading="store.rankedSeasonMmrLoading"
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSwipe, useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import StandingsTable from '@/components/tournament/StandingsTable.vue'
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
const statsSubTab = ref<'profile' | 'global'>(
  route.query.statsSub === 'global' ? 'global' : 'profile',
)
const standingsTypeValues = ['official', 'provisional'] as const

const activeTab = computed(() => (route.params.tab as string) || 'infos')

watch(
  () => activeTab.value === 'stats' && store.tournament?.mode === 'ranked',
  async (shouldLoad) => {
    if (shouldLoad) await store.ensurePlayerProfile()
  },
  { immediate: true },
)

const statsSubTabValues = ['profile', 'global'] as const

/** Keeps the two stats panes out of the DOM until the Stats tab is opened once. */
const statsTabVisited = ref(false)
watch(
  () => activeTab.value === 'stats',
  (isStats) => {
    if (isStats) statsTabVisited.value = true
  },
  { immediate: true },
)

/** Must match the `.stats-synced` transition duration. */
const SETTLE_MS = 140
/** Movement below this is still ambiguous, so the drag axis is not locked yet. */
const AXIS_LOCK_PX = 8
/** Past a quarter of the viewport width the swipe commits instead of snapping back. */
const COMMIT_RATIO = 0.25
const COMMIT_MIN_PX = 60
/** Standings has no live drag, so it keeps requiring a deliberate swipe. */
const STANDINGS_SWIPE_PX = 50

const bothStatsPanesVisible = ref(false)
const statsTrackRef = ref<HTMLElement | null>(null)
const statsPillRef = ref<HTMLElement | null>(null)
const profileLabelRef = ref<HTMLElement | null>(null)
const globalLabelRef = ref<HTMLElement | null>(null)
const profilePaneRef = ref<HTMLElement | null>(null)
const globalPaneRef = ref<HTMLElement | null>(null)
const statsPaneShifts = ref<Record<'profile' | 'global', number>>({ profile: 0, global: 0 })
let dragAxis: 'none' | 'x' | 'y' = 'none'
let dragOffset = 0
let gestureWidth = 0
let collapseTimer: ReturnType<typeof setTimeout> | undefined

const statsDragEnabled = computed(
  () =>
    activeTab.value === 'stats' &&
    store.tournament?.mode === 'ranked' &&
    store.isAuthenticated &&
    statsTabVisited.value,
)

/** Elements whose transition and layer hints are driven by hand during a gesture. */
function statsAnimatedEls() {
  return [statsTrackRef.value, statsPillRef.value, profileLabelRef.value, globalLabelRef.value]
}

/** Where the switcher sits between the panes once settled, as a pane index. */
function settledStatsProgress() {
  return statsSubTabValues.indexOf(statsSubTab.value)
}

/**
 * Panes, pill and label colours all derive from one progress value, so they cannot drift
 * apart. Written straight to the DOM instead of through bindings: this runs on every
 * touchmove, and re-rendering a template this size at touch frequency is what made a
 * swipe stutter.
 */
function applyStatsVisuals(progress: number) {
  const position = Math.min(statsSubTabValues.length - 1, Math.max(0, progress))

  if (statsTrackRef.value) statsTrackRef.value.style.transform = `translateX(${-position * 100}%)`
  // The pill is exactly one slot wide, so a full slot is one of its own widths.
  if (statsPillRef.value) statsPillRef.value.style.transform = `translateX(${position * 100}%)`

  // Labels fade between white (over the pill) and the idle grey carried by `--stats-idle`,
  // which the template switches per theme. `color-mix` is unsupported on older engines,
  // where the declaration is dropped and the label simply keeps its inherited colour.
  ;[profileLabelRef.value, globalLabelRef.value].forEach((label, index) => {
    if (!label) return
    const share = Math.round((1 - Math.min(1, Math.abs(position - index))) * 100)
    label.style.color = `color-mix(in oklab, white ${share}%, var(--stats-idle))`
  })
}

/** While the finger is down the visuals are pinned to it, with no easing in between. */
function pinStatsVisuals(pinned: boolean) {
  for (const el of statsAnimatedEls()) {
    if (el) el.style.transitionDuration = pinned ? '0s' : ''
  }
}

/**
 * Kept to the length of a gesture on purpose: a permanent `will-change` would leave the
 * whole chart-heavy track promoted to its own compositor layer, which is by itself enough
 * to make ordinary vertical scrolling stutter on mobile.
 */
function promoteStatsLayers(promoted: boolean) {
  for (const el of [statsTrackRef.value, statsPillRef.value]) {
    if (el) el.style.willChange = promoted ? 'transform' : ''
  }
}

/** Places the visuals without easing, so a sub-tab restored from the URL does not slide in. */
function placeStatsVisuals() {
  pinStatsVisuals(true)
  applyStatsVisuals(settledStatsProgress())
  requestAnimationFrame(() => pinStatsVisuals(false))
}

// Button taps go through this watcher; drags apply their own settle in `onSwipeEnd`.
watch(statsSubTab, () => applyStatsVisuals(settledStatsProgress()), { flush: 'post' })
// The track only exists from the first visit onwards, and must appear already in place.
watch(statsTabVisited, placeStatsVisuals, { flush: 'post' })
onMounted(placeStatsVisuals)

/**
 * The two panes share the document scroll but rarely have the same height, so a deep
 * scroll on the taller one sits past the end of the shorter one: revealing it mid-swipe
 * would show blank space, and releasing would snap the page back up to its end. Shifting
 * the shorter pane down by that overshoot puts its end on screen instead. The shift is
 * dropped again together with a matching scroll correction, so nothing moves on settle.
 */
function measureStatsPaneShifts() {
  const contentArea = contentAreaRef.value
  if (!contentArea) return

  const scrollY = window.scrollY
  const viewport = window.innerHeight
  // Trailing padding that normally keeps the last rows clear of the fixed bottom nav.
  const trailing = Number.parseFloat(getComputedStyle(contentArea).paddingBottom) || 0

  const shiftFor = (el: HTMLElement | null) => {
    if (!el) return 0
    const paneEnd = el.getBoundingClientRect().bottom + scrollY + trailing
    return Math.max(0, scrollY - Math.max(0, paneEnd - viewport))
  }

  statsPaneShifts.value = {
    profile: shiftFor(profilePaneRef.value),
    global: shiftFor(globalPaneRef.value),
  }
}

function expandBothStatsPanes() {
  if (collapseTimer) clearTimeout(collapseTimer)
  // Measuring while a previous shift is still applied would compound it.
  if (!bothStatsPanesVisible.value) measureStatsPaneShifts()
  bothStatsPanesVisible.value = true
}

/**
 * Undoes the shift of whichever pane ended up active and scrolls by the same amount, so
 * the two cancel out and the page does not jump when the idle pane collapses.
 */
function collapseIdleStatsPane() {
  const shift = statsPaneShifts.value[statsSubTab.value]
  if (shift > 0) window.scrollTo({ top: Math.max(0, window.scrollY - shift), behavior: 'auto' })
  statsPaneShifts.value = { profile: 0, global: 0 }
  bothStatsPanesVisible.value = false
  promoteStatsLayers(false)
}

/** Collapses the idle pane only once the settle animation has finished. */
function scheduleStatsPaneCollapse() {
  if (collapseTimer) clearTimeout(collapseTimer)
  collapseTimer = setTimeout(collapseIdleStatsPane, SETTLE_MS + 30)
}

onBeforeUnmount(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})

/** There is nothing beyond the first and last pane, so drags outward are ignored. */
function clampStatsDrag(offset: number) {
  const index = statsSubTabValues.indexOf(statsSubTab.value)
  if (offset < 0 && index >= statsSubTabValues.length - 1) return 0
  if (offset > 0 && index <= 0) return 0
  return offset
}

function resetStatsDrag() {
  dragOffset = 0
  dragAxis = 'none'
}

/**
 * `useSwipe` only reports a `direction` past its own `threshold`, which is lowered here
 * so `onSwipe` fires early enough to track the finger. Consumers that want a deliberate
 * swipe rather than a drag therefore have to state their own minimum distance.
 */
function swipeDirection(minPx: number): 'left' | 'right' | null {
  const dx = lengthX.value
  if (Math.abs(dx) < minPx || Math.abs(dx) <= Math.abs(lengthY.value)) return null
  return dx > 0 ? 'left' : 'right'
}

const { lengthX, lengthY } = useSwipe(contentAreaRef, {
  threshold: AXIS_LOCK_PX,
  onSwipeStart() {
    dragAxis = 'none'
    dragOffset = 0
  },
  onSwipe() {
    if (!statsDragEnabled.value) return
    // Lock to one axis on the first significant movement, so a vertical scroll
    // never drags the track sideways (and vice versa).
    if (dragAxis === 'none') {
      const dx = Math.abs(lengthX.value)
      const dy = Math.abs(lengthY.value)
      if (Math.max(dx, dy) < AXIS_LOCK_PX) return
      dragAxis = dx > dy ? 'x' : 'y'
      if (dragAxis !== 'x') return
      // The page cannot scroll while the track is being dragged, so the width is
      // measured once here instead of being read back on every frame.
      gestureWidth = contentAreaRef.value?.clientWidth ?? 0
      expandBothStatsPanes()
      pinStatsVisuals(true)
      promoteStatsLayers(true)
    }
    if (dragAxis !== 'x') return
    // `lengthX` is positive when the finger moves left; the track follows it.
    dragOffset = clampStatsDrag(-lengthX.value)
    applyStatsVisuals(settledStatsProgress() - (gestureWidth ? dragOffset / gestureWidth : 0))
  },
  onSwipeEnd() {
    if (activeTab.value === 'standings') {
      const direction = swipeDirection(STANDINGS_SWIPE_PX)
      const currentIndex = standingsTypeValues.indexOf(standingsType.value)
      const next = standingsTypeValues[currentIndex + 1]
      const prev = standingsTypeValues[currentIndex - 1]
      if (direction === 'left' && next) standingsType.value = next
      else if (direction === 'right' && prev) standingsType.value = prev
      return
    }

    if (!statsDragEnabled.value || dragAxis !== 'x') {
      resetStatsDrag()
      return
    }

    const threshold = Math.max(COMMIT_MIN_PX, gestureWidth * COMMIT_RATIO)
    const currentIndex = statsSubTabValues.indexOf(statsSubTab.value)
    const next = statsSubTabValues[currentIndex + 1]
    const prev = statsSubTabValues[currentIndex - 1]

    if (dragOffset <= -threshold && next) setStatsSubTab(next)
    else if (dragOffset >= threshold && prev) setStatsSubTab(prev)
    else scheduleStatsPaneCollapse() // below the threshold: snap back to the current pane

    // Restoring the easing before writing the settled position makes the track animate
    // from wherever the finger left it, whether the swipe committed or snapped back.
    pinStatsVisuals(false)
    applyStatsVisuals(settledStatsProgress())
    resetStatsDrag()
  },
})

/**
 * Dragging the track and scrolling the page at the same time is both meaningless and
 * expensive, so once the gesture is known to be horizontal the scroll is cancelled. The
 * listener has to be non-passive to do that, and it is registered after `useSwipe` so
 * `dragAxis` is already up to date for the event being handled. Other tabs never reach
 * the `'x'` lock, so their own horizontal panning is untouched.
 */
useEventListener(
  contentAreaRef,
  'touchmove',
  (e: TouchEvent) => {
    if (dragAxis === 'x') e.preventDefault()
  },
  { passive: false },
)

function setStatsSubTab(tab: 'profile' | 'global') {
  expandBothStatsPanes()
  statsSubTab.value = tab
  scheduleStatsPaneCollapse()
  router.replace({ query: { ...route.query, statsSub: tab === 'global' ? 'global' : undefined } })
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
/* Panes, pill and labels share one clock, so the switcher cannot drift away from
   the track mid-swipe. This is deliberately quicker than the 300ms of the bottom
   nav: the pill has to keep up with a finger, not answer a tap. Only the settle
   animation is timed; while the finger is down everything is pinned to it. The
   decelerating curve front-loads the movement, so 140ms still lands as "instant"
   without looking cut off. */
.stats-synced {
  transition-duration: 0.14s;
  transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}

.stats-synced-transform {
  transition-property: transform;
}

.stats-synced-color {
  transition-property: color;
}

@media (prefers-reduced-motion: reduce) {
  .stats-synced {
    transition-duration: 0.01ms;
  }
}
</style>
