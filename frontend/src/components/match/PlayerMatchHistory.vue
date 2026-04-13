<template>
  <div>
    <!-- Filter chips -->
    <div class="flex items-center gap-2 overflow-x-auto py-2 mb-4 no-scrollbar">
      <span class="font-label text-xs text-muted-color uppercase tracking-widest shrink-0">Filtrer par</span>
      <button
        v-for="f in availableFilters"
        :key="f.value"
        @click="toggleFilter(f.value)"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 active:scale-95"
        :class="
          activeFilters.has(f.value)
            ? 'bg-surface-600 border-surface-500 text-color'
            : 'bg-surface-800 border-surface-700/20 text-muted-color'
        "
      >
        <i :class="f.icon" class="text-xs"></i>
        <span class="font-label text-xs font-bold uppercase tracking-wider">{{ f.label }}</span>
      </button>
    </div>

    <!-- Scrollable list -->
    <div
      ref="container"
      class="overflow-y-auto pr-1"
      style="max-height: calc(100vh - 260px)"
    >
      <!-- Initial loading -->
      <div v-if="loading && history.length === 0" class="flex justify-center py-12">
        <ProgressSpinner />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredHistory.length === 0 && !loading"
        class="text-center py-12 text-muted-color"
      >
        <i class="fa fa-clock text-4xl mb-4 block"></i>
        <p class="font-label text-sm">Aucun match dans l'historique</p>
      </div>

      <!-- Match cards grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="entry in filteredHistory"
          :key="entry.id"
          class="group relative overflow-hidden rounded-xl bg-surface-800 border border-surface-700/10 hover:bg-surface-700 transition-all duration-300 cursor-pointer"
        @click="navigateToMatch(entry.matchId)"
      >
        <div class="px-3 pt-2.5 pb-2 relative z-10">
          <!-- Top row: status | result badge + MMR -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <span class="flex h-1.5 w-1.5 rounded-full shrink-0" :class="statusDotClass(entry.status)"></span>
              <span class="font-label text-xs uppercase font-bold tracking-tighter" :class="statusTextClass(entry.status)">
                {{ statusLabel(entry.status) }}
              </span>
              <span class="font-label text-xs text-muted-color">· {{ badgeLabel(entry) }}</span>
              <span v-if="entry.outcomeType" class="font-label text-xs text-muted-color">· {{ entry.outcomeType.name }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="entry.mmrDelta !== null"
                class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border font-headline font-black tabular-nums text-sm"
                :class="mmrPillClass(entry.mmrDelta)"
              >
                <i class="fa fa-bolt text-xs"></i>
                {{ entry.mmrDelta > 0 ? '+' : '' }}{{ entry.mmrDelta }}
              </span>
              <span
                class="font-headline text-xs font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border"
                :class="resultBadgeClass(entry)"
              >
                {{ outcomeLabel(entry) }}
              </span>
            </div>
          </div>

          <!-- Center: my side | score (if any) | opp side -->
          <div class="flex items-center gap-2 pt-3">
            <!-- My side -->
            <div class="flex-1 flex flex-col items-center gap-1 relative">
              <div v-if="entry.status !== 'cancelled' && winnerSideIs(entry, 'A')" class="absolute -top-6 left-1/2 -translate-x-1/2">
                <i class="fa fa-trophy text-yellow-500 flex-shrink-0 text-xs"></i>
              </div>
              <div class="flex items-center" :class="getMySide(entry).length > 1 ? '-space-x-2' : ''">
                <div
                  v-for="(player, idx) in getMySide(entry).slice(0, 2)"
                  :key="player.id"
                  class="w-9 h-9 rounded-md border border-surface-900 flex items-center justify-center text-sm font-bold uppercase"
                  :class="idx === 0 ? outcomeRingClass(entry) : 'ring-1 ring-surface-700/20'"
                  :style="{ zIndex: 30 - idx * 10, background: getAvatarBg(player.shortName) }"
                >
                  {{ getInitials(player.shortName) }}
                </div>
                <span v-if="getMySide(entry).length > 2" class="ml-1 font-label text-xs text-muted-color self-center">
                  +{{ getMySide(entry).length - 2 }}
                </span>
              </div>
              <div class="flex flex-col items-center gap-0.5">
                <span
                  v-for="player in getMySide(entry).slice(0, 2)"
                  :key="player.id"
                  class="font-label text-xs font-semibold uppercase tracking-tight truncate max-w-18 text-center"
                  :class="player.id === entry.playerId ? 'text-color/80' : 'text-color/50'"
                >
                  {{ player.shortName }}
                </span>
              </div>
            </div>

            <!-- Score (only when recorded) -->
            <div
              v-if="hasScore(entry)"
              class="font-headline text-2xl font-black tracking-tighter flex items-center gap-1.5 shrink-0"
              :class="outcomeScoreClass(entry)"
            >
              <span>{{ myScore(entry) }}</span>
              <span class="text-muted-color/40 text-base">-</span>
              <span>{{ oppScore(entry) }}</span>
            </div>

            <!-- Opponent side -->
            <div class="flex-1 flex flex-col items-center gap-1 relative">
              <div v-if="entry.status !== 'cancelled' && winnerSideIs(entry, 'B')" class="absolute -top-6 left-1/2 -translate-x-1/2">
                <i class="fa fa-trophy text-yellow-500 shrink-0 text-xs"></i>
              </div>
              <div class="flex items-center" :class="getOppSide(entry).length > 1 ? '-space-x-2' : ''">
                <div
                  v-for="(player, idx) in getOppSide(entry).slice(0, 2)"
                  :key="player.id"
                  class="w-8 h-8 rounded-md border border-surface-900 ring-1 ring-surface-700/20 flex items-center justify-center text-[11px] font-bold uppercase"
                  :style="{ zIndex: 30 - idx * 10, background: getAvatarBg(player.shortName) }"
                >
                  {{ getInitials(player.shortName) }}
                </div>
                <span v-if="getOppSide(entry).length > 2" class="ml-1 font-label text-xs text-muted-color self-center">
                  +{{ getOppSide(entry).length - 2 }}
                </span>
              </div>
              <div class="flex flex-col items-center gap-0.5">
                <span
                  v-for="player in getOppSide(entry).slice(0, 2)"
                  :key="player.id"
                  class="font-label text-xs font-semibold uppercase tracking-tight truncate max-w-18 text-center text-color/50"
                >
                  {{ player.shortName }}
                </span>
              </div>
            </div>
          </div>

          <!-- Footer: date + link -->
          <div class="flex justify-between items-center mt-2 pt-2 border-t border-surface-700/10">
            <span class="font-label text-xs text-muted-color uppercase">
              {{ formatDate(entry.playedAt) }}
            </span>
            <RouterLink
              v-if="entry.matchId"
              :to="`/matches/${entry.matchId}`"
              @click.stop
              class="text-muted-color hover:text-color transition-colors active:scale-90"
            >
              <i class="fa fa-chevron-right text-xs leading-none"></i>
            </RouterLink>
          </div>
        </div>

        <!-- Bottom accent bar -->
        <div
          class="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full"
          :class="accentBarClass(entry)"
        ></div>
        </div>
      </div>

      <!-- Loading more -->
      <div v-if="loading && history.length > 0" class="flex justify-center py-4">
        <ProgressSpinner style="width: 28px; height: 28px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useInfiniteScroll } from '@vueuse/core'
import type { ClientMatchHistoryEntry } from '@skill-arena/shared/types/index'

const props = defineProps<{
  history: ClientMatchHistoryEntry[]
  loading?: boolean
  hasMore: boolean
  onLoadMore: () => Promise<void>
}>()

const router = useRouter()

type OutcomeFilter = 'WIN' | 'LOSS' | 'DRAW'

const activeFilters = ref(new Set<OutcomeFilter>())

const availableFilters = [
  { value: 'WIN' as OutcomeFilter, label: 'Victoire', icon: 'fa fa-trophy' },
  { value: 'LOSS' as OutcomeFilter, label: 'Défaite', icon: 'fa fa-times' },
  { value: 'DRAW' as OutcomeFilter, label: 'Nul', icon: 'fa fa-minus' },
]

function toggleFilter(value: OutcomeFilter) {
  const next = new Set(activeFilters.value)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  activeFilters.value = next
}

function outcome(entry: ClientMatchHistoryEntry): OutcomeFilter {
  // For ranked: use mmrDelta
  if (entry.mmrDelta !== null) {
    if (entry.mmrDelta > 0) return 'WIN'
    if (entry.mmrDelta < 0) return 'LOSS'
    return 'DRAW'
  }
  // For all modes: determine from winnerSide and player's position
  const mySide = entry.sides?.find((s) => s.players.some((p) => p.id === entry.playerId))
  if (!mySide || !entry.winnerSide) return 'DRAW'
  const myPosition = mySide.position // 1 = A, 2 = B
  const winnerIsA = entry.winnerSide === 'A'
  const iWon = (myPosition === 1 && winnerIsA) || (myPosition === 2 && !winnerIsA)
  return iWon ? 'WIN' : 'LOSS'
}

const filteredHistory = computed(() =>
  props.history.filter(
    (entry) => activeFilters.value.size === 0 || activeFilters.value.has(outcome(entry)),
  ),
)

function getMySide(entry: ClientMatchHistoryEntry) {
  return entry.sides?.find((s) => s.players.some((p) => p.id === entry.playerId))?.players ?? []
}

function getOppSide(entry: ClientMatchHistoryEntry) {
  return entry.sides?.find((s) => !s.players.some((p) => p.id === entry.playerId))?.players ?? []
}

function winnerSideIs(entry: ClientMatchHistoryEntry, side: 'A' | 'B') {
  return entry.winnerSide === side
}


function hasScore(entry: ClientMatchHistoryEntry) {
  return entry.tournament.scoreEnabled && entry.scoreA !== null && entry.scoreB !== null
}

function myScore(entry: ClientMatchHistoryEntry) {
  const mySide = entry.sides?.find((s) => s.players.some((p) => p.id === entry.playerId))
  if (!mySide) return entry.scoreA
  return mySide.position === 1 ? entry.scoreA : entry.scoreB
}

function oppScore(entry: ClientMatchHistoryEntry) {
  const mySide = entry.sides?.find((s) => s.players.some((p) => p.id === entry.playerId))
  if (!mySide) return entry.scoreB
  return mySide.position === 1 ? entry.scoreB : entry.scoreA
}

function outcomeLabel(entry: ClientMatchHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'Victoire'
  if (o === 'LOSS') return 'Défaite'
  return 'Égalité'
}

function resultBadgeClass(entry: ClientMatchHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'bg-match-win/10 border-match-win/30 text-match-win'
  if (o === 'LOSS') return 'bg-match-loss/10 border-match-loss/30 text-match-loss'
  return 'bg-surface-700/50 border-surface-600 text-muted-color'
}

function outcomeScoreClass(entry: ClientMatchHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'text-match-win'
  if (o === 'LOSS') return 'text-match-loss/80'
  return 'text-match-neutral'
}

function outcomeRingClass(entry: ClientMatchHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'ring-1 ring-match-win/40 text-match-win'
  if (o === 'LOSS') return 'ring-1 ring-match-loss/40 text-color'
  return 'ring-1 ring-surface-700/30 text-color'
}

function accentBarClass(entry: ClientMatchHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'bg-match-win'
  if (o === 'LOSS') return 'bg-match-loss'
  return 'bg-match-neutral'
}

function mmrPillClass(delta: number) {
  if (delta > 0) return 'bg-match-win/15 text-match-win border-match-win/30'
  if (delta < 0) return 'bg-match-loss/15 text-match-loss border-match-loss/30'
  return 'bg-match-neutral/15 text-match-neutral border-match-neutral/30'
}

function badgeLabel(entry: ClientMatchHistoryEntry) {
  const a = entry.teamSizeA ?? '?'
  const b = entry.teamSizeB ?? '?'
  return `${a}v${b}`
}

function statusDotClass(status: string) {
  switch (status) {
    case 'finalized': return 'bg-match-win/80'
    case 'ongoing': return 'bg-yellow-400 animate-pulse'
    case 'contested': return 'bg-match-loss animate-pulse'
    case 'reported': return 'bg-orange-400'
    default: return 'bg-surface-500'
  }
}

function statusTextClass(status: string) {
  switch (status) {
    case 'finalized': return 'text-match-win/80'
    case 'ongoing': return 'text-yellow-400'
    case 'contested': return 'text-match-loss'
    case 'reported': return 'text-orange-400'
    default: return 'text-muted-color'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'finalized': return 'Validé'
    case 'ongoing': return 'En cours'
    case 'contested': return 'Contesté'
    case 'cancelled': return 'Annulé'
    case 'reported': return 'En attente'
    default: return status
  }
}

function formatDate(date: Date | string | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function navigateToMatch(matchId: string) {
  router.push(`/matches/${matchId}`)
}

const AVATAR_COLORS = [
  '#1e3a5f', '#2d1b69', '#1a3a2a', '#3d1f1f', '#1f3d3d',
  '#3d2d1f', '#2d1f3d', '#1f2d3d', '#3d3d1f', '#1f3d1f',
]

function getAvatarBg(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getInitials(name: string) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

const container = ref<HTMLElement | null>(null)

useInfiniteScroll(
  container,
  async () => {
    await props.onLoadMore()
  },
  {
    distance: 100,
    canLoadMore: () => props.hasMore && !props.loading,
  },
)
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
