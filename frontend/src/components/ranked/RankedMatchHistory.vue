<template>
  <div>
    <!-- Filter tags -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <button
        v-for="f in availableFilters"
        :key="f.value"
        @click="toggleFilter(f.value)"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors duration-150"
        :class="
          activeFilters.has(f.value)
            ? f.activeClass
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        "
      >
        <i :class="f.icon" class="text-xs"></i>
        {{ f.label }}
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
        v-else-if="filteredHistoryWithIndex.length === 0 && !loading"
        class="text-center py-12 text-gray-500 dark:text-gray-400"
      >
        <i class="fa fa-clock text-4xl mb-4 block"></i>
        <p>Aucun match dans l'historique</p>
      </div>

      <!-- Match cards -->
      <div
        v-for="{ entry, originalIndex } in filteredHistoryWithIndex"
        :key="entry.id"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
      >
        <div class="flex items-start gap-3">
          <!-- Match number (absolute, descending) -->
          <span
            class="text-2xl font-bold text-gray-200 dark:text-gray-700 w-10 shrink-0 pt-0.5 tabular-nums"
          >
            {{ totalMatches - originalIndex }}
          </span>

          <!-- Card content -->
          <div class="flex-1 min-w-0">
            <!-- Row 1: badges + result + delta -->
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Team size badge -->
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 shrink-0"
              >
                {{ badgeLabel(entry) }}
              </span>

              <!-- Match status badge -->
              <Tag
                :severity="statusSeverity(entry.match?.status)"
                :value="statusLabel(entry.match?.status)"
                class="text-xs shrink-0"
              />

              <div class="flex-1"></div>

              <!-- Result label -->
              <span
                :class="outcomeClass(entry)"
                class="text-sm font-bold uppercase tracking-wide shrink-0"
              >
                {{ outcomeLabel(entry) }}
              </span>

              <!-- MMR delta -->
              <span :class="deltaClass(entry.mmrDelta)" class="font-bold tabular-nums shrink-0">
                {{ entry.mmrDelta > 0 ? '+' : '' }}{{ entry.mmrDelta }}
              </span>

              <!-- Match context label -->
              <span
                v-if="matchLabel(entry)"
                class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium shrink-0"
              >
                {{ matchLabel(entry) }}
              </span>
            </div>

            <!-- Row 2: players -->
            <div v-if="hasPlayers(entry)" class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <!-- Teammates (only if more than 1 player on my side) -->
              <div
                v-if="getSides(entry).teammates.length > 0"
                class="flex items-center gap-1.5 min-w-0"
              >
                <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">Avec :</span>
                <div class="flex items-center gap-1 flex-wrap">
                  <span
                    v-for="p in getSides(entry).teammates.slice(0, 2)"
                    :key="p.id"
                    class="text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span class="hidden sm:inline">{{ p.displayName }}</span>
                    <span class="sm:hidden">{{ p.shortName }}</span>
                  </span>
                  <span
                    v-if="getSides(entry).teammates.length > 2"
                    class="text-xs text-gray-400 dark:text-gray-500"
                  >
                    +{{ getSides(entry).teammates.length - 2 }}
                  </span>
                </div>
              </div>

              <!-- Opponents -->
              <div
                v-if="getSides(entry).opponents.length > 0"
                class="flex items-center gap-1.5 min-w-0"
              >
                <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">Contre :</span>
                <div class="flex items-center gap-1 flex-wrap">
                  <span
                    v-for="p in getSides(entry).opponents.slice(0, 2)"
                    :key="p.id"
                    class="text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    <span class="hidden sm:inline">{{ p.displayName }}</span>
                    <span class="sm:hidden">{{ p.shortName }}</span>
                  </span>
                  <span
                    v-if="getSides(entry).opponents.length > 2"
                    class="text-xs text-gray-400 dark:text-gray-500"
                  >
                    +{{ getSides(entry).opponents.length - 2 }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Row 3: date + link -->
            <div class="flex items-center mt-1.5">
              <span class="text-xs text-gray-400 dark:text-gray-500">
                {{ formatDate(entry.match?.playedAt) }}
              </span>
              <RouterLink
                v-if="entry.matchId"
                :to="`/matches/${entry.matchId}`"
                class="ml-auto text-xs text-blue-500 hover:underline dark:text-blue-400 shrink-0"
              >
                Voir le match
              </RouterLink>
            </div>
          </div>
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
import { useInfiniteScroll } from '@vueuse/core'
import type { ClientMmrHistoryEntry } from '@skill-arena/shared/types/index'
import { getMatchLabel } from '@/composables/ranked/ranked.service'

const props = defineProps<{
  history: ClientMmrHistoryEntry[]
  loading?: boolean
  hasMore: boolean
  allowDraw: boolean
  totalMatches: number
  onLoadMore: () => Promise<void>
}>()

type OutcomeFilter = 'WIN' | 'LOSS' | 'DRAW'

const activeFilters = ref(new Set<OutcomeFilter>())

const availableFilters = computed(() => {
  const filters: { value: OutcomeFilter; label: string; icon: string; activeClass: string }[] = [
    {
      value: 'WIN',
      label: 'Victoire',
      icon: 'fa fa-trophy',
      activeClass:
        'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400',
    },
    {
      value: 'LOSS',
      label: 'Défaite',
      icon: 'fa fa-times',
      activeClass:
        'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400',
    },
  ]
  if (props.allowDraw) {
    filters.push({
      value: 'DRAW',
      label: 'Nul',
      icon: 'fa fa-minus',
      activeClass:
        'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300',
    })
  }
  return filters
})

function toggleFilter(value: OutcomeFilter) {
  const next = new Set(activeFilters.value)
  if (next.has(value)) {
    next.delete(value)
    // If none left, clear all (show everything)
    if (next.size === 0) {
      activeFilters.value = new Set()
      return
    }
  } else {
    next.add(value)
  }
  activeFilters.value = next
}

function outcome(entry: ClientMmrHistoryEntry): OutcomeFilter {
  if (entry.mmrDelta > 0) return 'WIN'
  if (entry.mmrDelta < 0) return 'LOSS'
  return 'DRAW'
}

const filteredHistoryWithIndex = computed(() =>
  props.history
    .map((entry, i) => ({ entry, originalIndex: i }))
    .filter(
      ({ entry }) => activeFilters.value.size === 0 || activeFilters.value.has(outcome(entry)),
    ),
)

function outcomeLabel(entry: ClientMmrHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'Victoire'
  if (o === 'LOSS') return 'Défaite'
  return 'Égalité'
}

function outcomeClass(entry: ClientMmrHistoryEntry) {
  const o = outcome(entry)
  if (o === 'WIN') return 'text-green-600 dark:text-green-400'
  if (o === 'LOSS') return 'text-red-500 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function deltaClass(delta: number) {
  if (delta > 0) return 'text-green-600 dark:text-green-400'
  if (delta < 0) return 'text-red-500 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function badgeLabel(entry: ClientMmrHistoryEntry) {
  const a = entry.teamSizeA ?? '?'
  const b = entry.teamSizeB ?? '?'
  return `${a}v${b}`
}

function getSides(entry: ClientMmrHistoryEntry) {
  const mySide = entry.sides?.find((s) => s.players.some((p) => p.id === entry.playerId))
  const oppSide = entry.sides?.find((s) => !s.players.some((p) => p.id === entry.playerId))
  return {
    teammates: mySide?.players.filter((p) => p.id !== entry.playerId) ?? [],
    opponents: oppSide?.players ?? [],
  }
}

function hasPlayers(entry: ClientMmrHistoryEntry) {
  const { teammates, opponents } = getSides(entry)
  return teammates.length > 0 || opponents.length > 0
}

function statusSeverity(status?: string) {
  switch (status) {
    case 'finished':
      return 'secondary'
    case 'ongoing':
      return 'info'
    case 'contested':
      return 'warn'
    case 'cancelled':
      return 'danger'
    default:
      return 'secondary'
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case 'finalized':
      return 'Finalisé'
    case 'ongoing':
      return 'En cours'
    case 'contested':
      return 'Contesté'
    case 'cancelled':
      return 'Annulé'
    default:
      return status ?? '—'
  }
}

function matchLabel(entry: ClientMmrHistoryEntry): string | null {
  return getMatchLabel(entry.mmrBefore, entry.opponentAvgMmr, entry.mmrDelta)
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
