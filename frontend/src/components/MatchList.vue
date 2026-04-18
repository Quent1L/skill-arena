<template>
  <div class="match-list">
    <!-- Filters row -->
    <div v-if="showFilters" class="mb-4 flex flex-wrap justify-between gap-2">
      <!-- "Mes matchs" + outcome chips -->
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          v-if="props.currentPlayerId"
          @click="toggleMyMatches"
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 cursor-pointer"
          :class="
            myMatchesActive
              ? 'bg-primary border-primary text-primary-contrast'
              : 'bg-surface-800 border-surface-700/20 text-muted-color'
          "
        >
          <i class="fa fa-user text-xs"></i>
          <span class="font-label text-xs font-bold uppercase tracking-wider">Mes matchs</span>
        </button>

        <template v-if="myMatchesActive">
          <button
            v-for="f in outcomeFilters"
            :key="f.value"
            @click="toggleOutcome(f.value)"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 cursor-pointer"
            :class="
              activeOutcomes.has(f.value)
                ? 'bg-surface-600 border-surface-500 text-color'
                : 'bg-surface-800 border-surface-700/20 text-muted-color'
            "
          >
            <i :class="f.icon" class="text-xs"></i>
            <span class="font-label text-xs font-bold uppercase tracking-wider">{{ f.label }}</span>
          </button>
        </template>
      </div>

      <!-- Player filter -->
      <div v-if="props.players && props.players.length > 0">
        <!-- Desktop: AutoComplete with chips -->
        <div v-if="!isMobile" class="flex items-center gap-2">
          <AutoComplete
            v-model="selectedPlayers"
            :suggestions="suggestions"
            option-label="displayName"
            multiple
            placeholder="Filtrer par joueur..."
            @complete="onSearch"
          />
        </div>

        <!-- Mobile: filter button + PlayerPickerDialog -->
        <div v-else>
          <Button text severity="secondary" size="small" @click="showMobileDialog = true">
            <i class="fa fa-filter mr-2" />
            Filtres
            <span
              v-if="selectedPlayers.length > 0"
              class="ml-2 bg-primary text-primary-contrast rounded-full text-xs w-5 h-5 flex items-center justify-center"
            >
              {{ selectedPlayers.length }}
            </span>
          </Button>
          <PlayerPickerDialog
            v-model:visible="showMobileDialog"
            title="Filtrer par joueur"
            :players="props.players"
            :selected-ids="selectedPlayers.map((p) => p.id)"
            @update:selected-ids="onMobileSelection"
          />
        </div>
      </div>
    </div>

    <!-- Initial loading -->
    <div v-if="loading && matches.length === 0" class="flex justify-center py-6">
      <ProgressSpinner />
    </div>

    <div v-else>
      <div v-if="displayedMatches.length === 0" class="text-center py-6 text-muted-color">
        <i class="fa fa-clock text-4xl mb-4 block"></i>
        <p class="font-label text-sm">Aucun match trouvé.</p>
      </div>

      <!-- Match cards grid -->
      <div
        v-else
        ref="container"
        class="overflow-y-auto pr-1"
        style="max-height: calc(100vh - 260px)"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MatchCard
            v-for="match in displayedMatches"
            :key="match.id"
            :entry="match"
            :current-player-id="myMatchesActive ? props.currentPlayerId : undefined"
          />
        </div>

        <!-- Loading more -->
        <div v-if="loading" class="flex justify-center py-4">
          <ProgressSpinner style="width: 28px; height: 28px" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'
import { matchApi } from '@/composables/match/match.api'
import type { ClientMatchCard, MatchCardSide } from '@skill-arena/shared/types/index'
import { useViewport } from '@/composables/useViewport'
import MatchCard from './match/MatchCard.vue'
import PlayerPickerDialog from './match/mobile/PlayerPickerDialog.vue'

interface Player {
  id: string
  displayName: string
}

interface Props {
  tournamentId?: string
  playerId?: string
  currentPlayerId?: string
  players?: Player[]
  pageSize?: number
  bracketMode?: boolean
  allowDraw?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
})

const matches = ref<ClientMatchCard[]>([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const container = ref<HTMLElement | null>(null)
let offset = 0

const { isMobile } = useViewport()

const selectedPlayers = ref<Player[]>([])
const suggestions = ref<Player[]>([])
const showMobileDialog = ref(false)

const myMatchesActive = ref(false)

type OutcomeFilter = 'WIN' | 'LOSS' | 'DRAW'
const activeOutcomes = ref(new Set<OutcomeFilter>())

const outcomeFilters = computed(() => {
  const filters = [
    { value: 'WIN' as OutcomeFilter, label: 'Victoire', icon: 'fa fa-trophy' },
    { value: 'LOSS' as OutcomeFilter, label: 'Défaite', icon: 'fa fa-times' },
  ]
  if (props.allowDraw !== false) {
    filters.push({ value: 'DRAW' as OutcomeFilter, label: 'Nul', icon: 'fa fa-minus' })
  }
  return filters
})

const showFilters = computed(
  () => props.currentPlayerId || (props.players && props.players.length > 0),
)

function toggleMyMatches() {
  myMatchesActive.value = !myMatchesActive.value
  if (!myMatchesActive.value) {
    activeOutcomes.value = new Set()
  }
  loadMatches()
}

function toggleOutcome(value: OutcomeFilter) {
  const next = new Set(activeOutcomes.value)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  activeOutcomes.value = next
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

const displayedMatches = computed(() => {
  if (!myMatchesActive.value || activeOutcomes.value.size === 0) return matches.value
  return matches.value.filter((m) => activeOutcomes.value.has(getOutcome(m)))
})

function onSearch(event: { query: string }) {
  const q = event.query.toLowerCase()
  suggestions.value = (props.players ?? [])
    .filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) &&
        !selectedPlayers.value.find((s) => s.id === p.id),
    )
    .slice(0, 8)
}

function onMobileSelection(ids: string[]) {
  selectedPlayers.value = (props.players ?? []).filter((p) => ids.includes(p.id))
}

function buildPlayerIds(): string | undefined {
  const ids = [
    props.playerId,
    myMatchesActive.value ? props.currentPlayerId : undefined,
    ...selectedPlayers.value.map((p) => p.id),
  ].filter(Boolean) as string[]
  return ids.length > 0 ? ids.join(',') : undefined
}

async function loadMatches(append = false) {
  if (!append) {
    matches.value = []
    offset = 0
    total.value = 0
    hasMore.value = false
  }

  loading.value = true
  try {
    const result = await matchApi.list({
      tournamentId: props.tournamentId,
      playerIds: buildPlayerIds(),
      bracketMode: props.bracketMode ? 'true' : undefined,
      limit: props.pageSize,
      offset,
    })
    if (append) {
      matches.value = [...matches.value, ...result.data]
    } else {
      matches.value = result.data
    }
    offset += result.data.length
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (err) {
    console.error('Erreur lors du chargement des matchs:', err)
  } finally {
    loading.value = false
  }
}

useInfiniteScroll(
  container,
  async () => {
    await loadMatches(true)
  },
  {
    distance: 100,
    canLoadMore: () => hasMore.value && !loading.value,
  },
)

watch(
  () => [props.tournamentId, props.playerId],
  () => loadMatches(),
  { immediate: true },
)
watch(selectedPlayers, () => loadMatches())
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
