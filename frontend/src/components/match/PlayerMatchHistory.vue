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
        <MatchCard
          v-for="entry in filteredHistory"
          :key="entry.id"
          :entry="entry"
          :current-player-id="entry.playerId"
        />
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
import type { ClientMatchCard, MatchCardSide } from '@skill-arena/shared/types/index'
import MatchCard from './MatchCard.vue'

const props = defineProps<{
  history: ClientMatchCard[]
  loading?: boolean
  hasMore: boolean
  onLoadMore: () => Promise<void>
}>()

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

function getOutcome(entry: ClientMatchCard): OutcomeFilter {
  if (entry.mmrDelta != null) {
    if (entry.mmrDelta > 0) return 'WIN'
    if (entry.mmrDelta < 0) return 'LOSS'
    return 'DRAW'
  }
  const mySide = entry.sides.find((s: MatchCardSide) =>
    s.players.some((p) => p.id === entry.playerId),
  )
  if (!mySide) return 'DRAW'
  if (mySide.isWinner) return 'WIN'
  const oppSide = entry.sides.find((s: MatchCardSide) => s !== mySide)
  if (oppSide?.isWinner) return 'LOSS'
  return 'DRAW'
}

const filteredHistory = computed(() =>
  props.history.filter(
    (entry) => activeFilters.value.size === 0 || activeFilters.value.has(getOutcome(entry)),
  ),
)

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
