<template>
  <div>
    <!-- Filter chips -->
    <div class="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
      <button
        v-for="f in availableFilters"
        :key="f.value"
        @click="toggleFilter(f.value)"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 active:scale-95"
        :class="
          activeFilters.has(f.value)
            ? f.activeClass
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
      class="overflow-y-auto space-y-3 pr-1"
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

      <!-- Match cards -->
      <div
        v-for="entry in filteredHistory"
        :key="entry.id"
        class="group relative overflow-hidden rounded-xl bg-surface-900 border border-surface-700/10 hover:bg-surface-800 transition-all duration-300 cursor-pointer"
        @click="navigateToMatch(entry.matchId)"
      >
        <div class="p-4 relative z-10">
          <!-- Top row: tournament info + result -->
          <div class="flex justify-between items-start mb-5">
            <!-- Left: tournament name + status -->
            <div class="flex flex-col min-w-0 mr-3">
              <span class="font-label text-[10px] text-muted-color uppercase tracking-widest truncate">
                {{ entry.tournament.name }}
              </span>
              <div class="mt-1 flex items-center gap-1.5">
                <span
                  class="flex h-1.5 w-1.5 rounded-full shrink-0"
                  :class="statusDotClass(entry.status)"
                ></span>
                <span class="font-label text-[9px] uppercase font-bold tracking-tighter" :class="statusTextClass(entry.status)">
                  {{ statusLabel(entry.status) }}
                </span>
              </div>
            </div>

            <!-- Right: result badge + MMR pill + outcomeType -->
            <div class="flex flex-col items-end shrink-0 gap-1">
              <!-- Result badge row -->
              <div class="flex items-center gap-2">
                <span
                  class="font-headline text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded border"
                  :class="resultBadgeClass(entry)"
                >
                  {{ outcomeLabel(entry) }}
                </span>
                <span class="font-label text-[8px] text-muted-color uppercase">
                  {{ badgeLabel(entry) }}
                </span>
              </div>

              <!-- MMR delta: prominent pill -->
              <div
                v-if="entry.mmrDelta !== null"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-headline font-black tabular-nums text-sm"
                :class="mmrPillClass(entry.mmrDelta)"
              >
                <i class="fa fa-bolt text-[10px]"></i>
                {{ entry.mmrDelta > 0 ? '+' : '' }}{{ entry.mmrDelta }}
                <span class="text-[10px] font-label font-bold opacity-70 ml-0.5">MMR</span>
              </div>

              <!-- outcomeType chip -->
              <span
                v-if="entry.outcomeType"
                class="font-label text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700/20 text-muted-color"
              >
                {{ entry.outcomeType.name }}
              </span>
            </div>
          </div>

          <!-- Center: avatars + score -->
          <div class="flex items-center justify-between gap-4">
            <!-- My side -->
            <div class="flex-1 flex flex-col items-center">
              <div v-if="getMySide(entry).length > 0" class="flex items-center mb-1" :class="getMySide(entry).length > 1 ? '-space-x-4' : ''">
                <div
                  v-for="(player, idx) in getMySide(entry).slice(0, 2)"
                  :key="player.id"
                  class="w-10 h-10 rounded-lg border-2 border-surface-900 flex items-center justify-center text-xs font-bold uppercase"
                  :class="idx === 0 ? outcomeRingClass(entry) : 'ring-1 ring-surface-700/20'"
                  :style="{ zIndex: 30 - idx * 10, background: getAvatarBg(player.shortName) }"
                >
                  {{ getInitials(player.shortName) }}
                </div>
                <div
                  v-if="getMySide(entry).length > 2"
                  class="w-10 h-10 rounded-lg bg-surface-800 border-2 border-surface-900 ring-1 ring-surface-700/20 flex items-center justify-center font-headline text-xs font-bold"
                  style="z-index: 10"
                >
                  +{{ getMySide(entry).length - 2 }}
                </div>
              </div>
              <span class="font-headline text-[10px] font-bold uppercase tracking-tight text-color/80 mt-1 text-center">
                {{ getMySideLabel(entry) }}
              </span>
            </div>

            <!-- Score / VS -->
            <div class="flex flex-col items-center">
              <div
                v-if="hasScore(entry)"
                class="font-headline text-2xl font-black tracking-tighter flex items-center gap-2"
                :class="outcomeScoreClass(entry)"
              >
                <span>{{ myScore(entry) }}</span>
                <span class="text-muted-color/50 text-lg">-</span>
                <span>{{ oppScore(entry) }}</span>
              </div>
              <div v-else class="font-headline text-xl font-black tracking-tighter italic uppercase" :class="outcomeScoreClass(entry)">
                VS
              </div>
            </div>

            <!-- Opponent side -->
            <div class="flex-1 flex flex-col items-center">
              <div v-if="getOppSide(entry).length > 0" class="flex items-center mb-1" :class="getOppSide(entry).length > 1 ? '-space-x-4' : ''">
                <div
                  v-for="(player, idx) in getOppSide(entry).slice(0, 2)"
                  :key="player.id"
                  class="w-10 h-10 rounded-lg border-2 border-surface-900 ring-1 ring-surface-700/20 flex items-center justify-center text-xs font-bold uppercase"
                  :style="{ zIndex: 30 - idx * 10, background: getAvatarBg(player.shortName) }"
                >
                  {{ getInitials(player.shortName) }}
                </div>
                <div
                  v-if="getOppSide(entry).length > 2"
                  class="w-10 h-10 rounded-lg bg-surface-800 border-2 border-surface-900 ring-1 ring-surface-700/20 flex items-center justify-center font-headline text-xs font-bold"
                  style="z-index: 10"
                >
                  +{{ getOppSide(entry).length - 2 }}
                </div>
              </div>
              <span class="font-headline text-[10px] font-bold uppercase tracking-tight text-color/60 mt-1 text-center">
                {{ getOppSideLabel(entry) }}
              </span>
            </div>
          </div>

          <!-- Footer: date + link -->
          <div class="flex justify-between items-center mt-4 pt-3 border-t border-surface-700/10">
            <span class="font-label text-[10px] text-muted-color uppercase">
              {{ formatDate(entry.playedAt) }}
            </span>
            <RouterLink
              v-if="entry.matchId"
              :to="`/matches/${entry.matchId}`"
              @click.stop
              class="bg-surface-800 p-1.5 rounded-lg hover:bg-match-win hover:text-surface-900 transition-colors active:scale-90"
            >
              <i class="fa fa-chevron-right text-sm leading-none"></i>
            </RouterLink>
          </div>
        </div>

        <!-- Bottom accent bar -->
        <div
          class="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 group-hover:w-full"
          :class="accentBarClass(entry)"
        ></div>
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
  {
    value: 'WIN' as OutcomeFilter,
    label: 'Victoire',
    icon: 'fa fa-trophy',
    activeClass: 'bg-match-win/10 border-match-win/40 text-match-win',
  },
  {
    value: 'LOSS' as OutcomeFilter,
    label: 'Défaite',
    icon: 'fa fa-times',
    activeClass: 'bg-match-loss/10 border-match-loss/40 text-match-loss',
  },
  {
    value: 'DRAW' as OutcomeFilter,
    label: 'Nul',
    icon: 'fa fa-minus',
    activeClass: 'bg-match-neutral/10 border-match-neutral/40 text-match-neutral',
  },
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

function getMySideLabel(entry: ClientMatchHistoryEntry) {
  const players = getMySide(entry)
  const me = players.find((p) => p.id === entry.playerId)
  if (!me) return 'Moi'
  const extra = players.length - 1
  return extra > 0 ? `${me.shortName} +${extra}` : me.shortName
}

function getOppSideLabel(entry: ClientMatchHistoryEntry) {
  const players = getOppSide(entry)
  if (players.length === 0) return '—'
  const extra = players.length - 1
  return extra > 0 ? `${players[0].shortName} +${extra}` : players[0].shortName
}

function hasScore(entry: ClientMatchHistoryEntry) {
  return entry.scoreA !== null && entry.scoreB !== null
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
  if (o === 'WIN') return 'bg-match-win/10 border-match-win/20 text-match-win'
  if (o === 'LOSS') return 'bg-match-loss/10 border-match-loss/20 text-match-loss'
  return 'bg-surface-800 border-surface-700/20 text-muted-color'
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
    case 'cancelled': return 'bg-match-neutral'
    default: return 'bg-match-neutral'
  }
}

function statusTextClass(status: string) {
  switch (status) {
    case 'finalized': return 'text-match-win/80'
    case 'ongoing': return 'text-yellow-400'
    case 'contested': return 'text-match-loss'
    case 'cancelled': return 'text-muted-color'
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
