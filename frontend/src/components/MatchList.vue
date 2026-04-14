<template>
  <div class="match-list">
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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
import MatchCard from './match/MatchCard.vue'

interface Props {
  tournamentId?: string
  playerId?: string
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
      playerId: props.playerId,
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
</script>
