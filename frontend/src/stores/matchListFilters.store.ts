import { ref } from 'vue'
import { defineStore } from 'pinia'

interface Player {
  id: string
  displayName: string
}

type OutcomeFilter = 'WIN' | 'LOSS' | 'DRAW'

export const useMatchListFiltersStore = defineStore('matchListFilters', () => {
  const contextKey = ref('')
  const myMatchesActive = ref(false)
  const selectedPlayers = ref<Player[]>([])
  const activeOutcomes = ref(new Set<OutcomeFilter>())
  // Organizers use this to pull up the matches waiting for their arbitration.
  const disputedOnly = ref(false)

  function initContext(key: string) {
    if (contextKey.value !== key) {
      contextKey.value = key
      reset()
    }
  }

  function reset() {
    myMatchesActive.value = false
    selectedPlayers.value = []
    activeOutcomes.value = new Set()
    disputedOnly.value = false
  }

  return {
    contextKey,
    myMatchesActive,
    selectedPlayers,
    activeOutcomes,
    disputedOnly,
    initContext,
    reset,
  }
})
