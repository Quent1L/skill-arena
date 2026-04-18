<template>
  <div class="match-list">
    <!-- Player filter -->
    <div v-if="props.players && props.players.length > 0" class="mb-4">

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
        <Button
          text
          severity="secondary"
          size="small"
          @click="showMobileDialog = true"
        >
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
          :selected-ids="selectedPlayers.map(p => p.id)"
          @update:selected-ids="onMobileSelection"
        />
      </div>

    </div>

    <!-- Initial loading -->
    <div v-if="loading && matches.length === 0" class="flex justify-center py-6">
      <ProgressSpinner />
    </div>

    <div v-else>
      <div v-if="matches.length === 0" class="text-center py-6 text-muted-color">
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
        <div class="grid grid-cols-1 md:grid-cols-2  gap-4">
          <MatchCard
            v-for="match in matches"
            :key="match.id"
            :entry="match"
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
import { ref, watch } from 'vue'
import { useInfiniteScroll } from '@vueuse/core'
import { matchApi } from '@/composables/match/match.api'
import type { ClientMatchCard } from '@skill-arena/shared/types/index'
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
  players?: Player[]
  pageSize?: number
  bracketMode?: boolean
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

function onSearch(event: { query: string }) {
  const q = event.query.toLowerCase()
  suggestions.value = (props.players ?? [])
    .filter(p => p.displayName.toLowerCase().includes(q) && !selectedPlayers.value.find(s => s.id === p.id))
    .slice(0, 8)
}

function onMobileSelection(ids: string[]) {
  selectedPlayers.value = (props.players ?? []).filter(p => ids.includes(p.id))
}

function buildPlayerIds(): string | undefined {
  const ids = [props.playerId, ...selectedPlayers.value.map(p => p.id)].filter(Boolean) as string[]
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

watch(() => [props.tournamentId, props.playerId], () => loadMatches(), { immediate: true })
watch(selectedPlayers, () => loadMatches())
</script>
