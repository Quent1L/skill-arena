<template>
  <div>
    <!-- Initial loading -->
    <div v-if="store.isInitialLoading">
      <div v-if="isMobile" class="flex justify-center py-12">
        <ProgressSpinner />
      </div>
      <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div
          class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-6"
        >
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

    <Message v-else-if="store.error" severity="error" class="mb-6 mx-4 mt-4">
      {{ store.error }}
    </Message>

    <div v-else-if="store.tournament">
      <!-- Mobile version -->
      <div v-if="isMobile" class="h-full">
        <!-- Sub-tabs (participants, teams, stats): accessible via cards, pas dans la bottom nav -->
        <div v-if="isMobileSubTab" class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
          <div
            class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-14 flex items-center px-4 shadow-sm"
          >
            <Button
              icon="fa fa-arrow-left"
              text
              rounded
              @click="router.back()"
              class="mr-2 !w-10 !h-10 text-gray-700 dark:text-gray-200"
            />
            <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {{ mobileSubTabTitles[activeTabName ?? ''] }}
            </h1>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <RouterView />
          </div>
        </div>
        <TournamentDetailMobile v-else />
      </div>

      <!-- Desktop version -->
      <div v-else class="bg-gray-50 dark:bg-gray-900">
        <!-- Hero header -->
        <div class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div class="max-w-5xl mx-auto px-6 pt-5" :class="isScrolled ? 'pb-3' : 'pb-5'">
            <div class="flex items-start gap-3">
              <Button
                icon="fa fa-arrow-left"
                text
                rounded
                @click="router.push('/')"
                class="shrink-0 mt-0.5! text-gray-500 dark:text-gray-400"
                v-tooltip.bottom="'Retour à l\'accueil'"
              />
              <div class="flex-1 min-w-0">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {{ store.tournament.name }}
                </h1>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    v-if="store.tournament.status === 'ongoing'"
                    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                  >
                    <span class="relative flex h-2 w-2">
                      <span
                        class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"
                      ></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    En cours
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    :class="statusClasses[store.tournament.status]"
                  >
                    {{ statusLabels[store.tournament.status] }}
                  </span>
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold"
                  >
                    {{ modeLabels[store.tournament.mode] }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Button
                  v-if="store.isAuthenticated && !store.isParticipant && store.canJoinTournament"
                  label="Participer"
                  icon="fa fa-user-plus"
                  @click="store.joinTournament()"
                  :loading="store.joining"
                  class="bg-green-600 hover:bg-green-700"
                />
                <div
                  v-if="store.isAuthenticated && store.isParticipant && !store.canLeaveTournament"
                  class="flex items-center gap-2 text-green-600 text-sm font-medium"
                >
                  <i class="fa fa-check-circle"></i>
                  <span>Inscrit</span>
                </div>
                <Button
                  v-if="store.canCreateMatch"
                  label="Créer un match"
                  icon="fa fa-plus"
                  @click="router.push(`/tournaments/${store.tournamentId}/create-match`)"
                  class="bg-blue-600 hover:bg-blue-700"
                />
                <OverflowMenuButton :items="store.menuItems" menu-id="desktop-header-menu" />
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <div class="max-w-5xl mx-auto px-6">
            <div ref="tabBarRef" class="flex relative">
              <button
                v-for="tab in visibleTabs"
                :key="tab.value"
                :ref="(el) => setTabRef(tab.value, el)"
                @click="navigateToTab(tab.value)"
                class="px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
                :class="
                  activeTabName === tab.value
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                "
              >
                {{ tab.label }}
              </button>
              <div
                class="absolute bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 transition-all duration-300 ease-out"
                :style="indicatorStyle"
              />
            </div>
          </div>
        </div>

        <!-- Tab content -->
        <div
          :class="
            activeTabName === 'bracket'
              ? 'max-w-[100rem] mx-auto px-6 py-6 h-full'
              : 'max-w-6xl mx-auto px-6 py-6 h-full'
          "
        >
          <RouterView />
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

    <!-- MMR Animation System -->
    <MmrRecapCard
      v-if="store.tournament?.mode === 'ranked' && animationQueue.showRecap.value"
      :events="animationQueue.queue.value"
      @close="animationQueue.dismissAll()"
    />
    <MmrRevealAnimation
      v-else-if="store.tournament?.mode === 'ranked' && animationQueue.currentEvent.value"
      :event="animationQueue.currentEvent.value"
      :tiers="store.rankedTiers"
      @close="animationQueue.acknowledgeCurrentEvent()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useWindowScroll } from '@vueuse/core'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'
import { useViewport } from '@/composables/useViewport'
import TournamentDetailMobile from '@/components/tournament/mobile/TournamentDetailMobile.vue'
import type { TournamentMode, MmrAnimationWsPayload } from '@skill-arena/shared'
import OverflowMenuButton from '@/components/OverflowMenuButton.vue'
import { onWsEvent } from '@/composables/notification/notification.socket'
import { useMMrAnimationQueue } from '@/composables/ranked/useMMrAnimationQueue'
import MmrRevealAnimation from '@/components/ranked/MmrRevealAnimation.vue'
import MmrRecapCard from '@/components/ranked/MmrRecapCard.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { isMobile } = useViewport()
const { y: scrollY } = useWindowScroll()
const store = useTournamentDetailStore()

const tabBarRef = ref<HTMLElement | null>(null)
const tabEls = ref<Record<string, HTMLElement | null>>({})
const indicatorStyle = ref({ left: '0px', width: '0px' })
const animationQueue = useMMrAnimationQueue()

const tournamentId = computed(() => route.params.id as string)
const activeTabName = computed(() => route.params.tab as string | undefined)
const isScrolled = computed(() => scrollY.value > 80)

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

const MOBILE_SUB_TABS = ['teams']
const mobileSubTabTitles: Record<string, string> = {
  teams: 'Équipes',
}
const isMobileSubTab = computed(() => MOBILE_SUB_TABS.includes(activeTabName.value ?? ''))

const visibleTabs = computed(() => {
  const mode = store.tournament?.mode
  const teamMode = store.tournament?.teamMode
  const tabs: { value: string; label: string; badge?: number }[] = [
    { value: 'infos', label: 'Infos' },
  ]
  if (teamMode === 'static') tabs.push({ value: 'teams', label: 'Équipes' })
  if (mode === 'championship') tabs.push({ value: 'standings', label: 'Classement' })
  if (mode === 'bracket') tabs.push({ value: 'bracket', label: 'Bracket' })
  if (mode === 'ranked') tabs.push({ value: 'standings', label: 'Classement' })
  tabs.push({ value: 'matches', label: 'Matchs' })
  tabs.push({ value: 'stats', label: 'Stats' })
  return tabs
})

function setTabRef(value: string, el: unknown) {
  tabEls.value[value] = el as HTMLElement | null
}

async function updateIndicator() {
  await nextTick()
  const el = tabEls.value[activeTabName.value ?? '']
  if (el) {
    indicatorStyle.value = { left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px` }
  }
}

function navigateToTab(tab: string) {
  router.push({ name: 'tournament-tab', params: { id: tournamentId.value, tab } })
}

watch(activeTabName, updateIndicator)
watch(visibleTabs, updateIndicator)

let offWs: (() => void) | null = null

onMounted(async () => {
  try {
    await store.initialize(tournamentId.value)
  } catch (err) {
    if (err instanceof Error && err.cause === 'ORGANIZATION_ACCESS_DENIED') {
      toast.add({
        severity: 'error',
        summary: 'Accès refusé',
        detail: "Vous n'avez pas accès à ce tournoi.",
        life: 4000,
      })
      router.replace('/')
      return
    }
    throw err
  }

  // Handle legacy ?tab= redirect
  const legacyTab = route.query.tab as string | undefined
  if (legacyTab) {
    router.replace({
      name: 'tournament-tab',
      params: { id: tournamentId.value, tab: legacyTab },
      query: {},
    })
    return
  }

  // Set default tab based on mode if no child route yet
  if (!route.params.tab) {
    const mode = store.tournament?.mode
    const defaultTab = mode === 'bracket' ? 'bracket' : 'standings'
    router.replace({ name: 'tournament-tab', params: { id: tournamentId.value, tab: defaultTab } })
  }

  await updateIndicator()

  if (store.tournament?.mode === 'ranked' && store.isAuthenticated) {
    await animationQueue.loadPending(tournamentId.value)
    offWs = onWsEvent('mmr_animation', (data) => {
      const payload = data as MmrAnimationWsPayload
      if (payload.tournamentId !== tournamentId.value) return
      animationQueue.enqueue(payload)
    })
  }
})

onUnmounted(() => {
  store.$dispose()
  if (offWs) offWs()
})
</script>

<style scoped>
.tournament-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}
</style>
