import { ref, computed } from 'vue'
import { bracketApi, type BracketType } from './bracket.api'
import type { ClientMatchModel } from '@skill-arena/shared/types/index'

export type BracketTreeType = 'winner' | 'loser' | 'grand_final'

export interface BracketRound {
  roundNumber: number
  matches: ClientMatchModel[]
}

export interface OrganizedBracket {
  winner: BracketRound[]
  loser: BracketRound[]
  grandFinal: ClientMatchModel[]
}

export function useBracketService() {
  const matches = ref<ClientMatchModel[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const generating = ref(false)

  const organizedBracket = computed<OrganizedBracket>(() => {
    return organizeBracketMatches(matches.value)
  })

  const hasMatches = computed(() => matches.value.length > 0)

  const isDoubleElimination = computed(() => {
    return matches.value.some((m) => m.bracketType === 'loser' || m.bracketType === 'grand_final')
  })

  function organizeBracketMatches(bracketMatches: ClientMatchModel[]): OrganizedBracket {
    const winner: Map<number, ClientMatchModel[]> = new Map()
    const loser: Map<number, ClientMatchModel[]> = new Map()
    const grandFinal: ClientMatchModel[] = []

    for (const match of bracketMatches) {
      if (match.bracketType === 'grand_final') {
        grandFinal.push(match)
      } else if (match.bracketType === 'loser') {
        const round = match.round ?? 1
        if (!loser.has(round)) loser.set(round, [])
        loser.get(round)!.push(match)
      } else {
        // winner bracket (default)
        const round = match.round ?? 1
        if (!winner.has(round)) winner.set(round, [])
        winner.get(round)!.push(match)
      }
    }

    const sortBySequence = (a: ClientMatchModel, b: ClientMatchModel) =>
      (a.sequence ?? 0) - (b.sequence ?? 0)

    const toRounds = (map: Map<number, ClientMatchModel[]>): BracketRound[] => {
      return Array.from(map.entries())
        .sort(([a], [b]) => a - b)
        .map(([roundNumber, roundMatches]) => ({
          roundNumber,
          matches: roundMatches.sort(sortBySequence),
        }))
    }

    return {
      winner: toRounds(winner),
      loser: toRounds(loser),
      grandFinal: grandFinal.sort(sortBySequence),
    }
  }

  async function loadBracket(tournamentId: string) {
    loading.value = true
    error.value = null
    try {
      const response = await bracketApi.getBracket(tournamentId)
      matches.value = response.matches
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du bracket'
      matches.value = []
    } finally {
      loading.value = false
    }
  }

  async function generateBracket(tournamentId: string, bracketType: BracketType) {
    generating.value = true
    error.value = null
    try {
      const response = await bracketApi.generateBracket(tournamentId, bracketType)
      // Reload bracket after generation
      await loadBracket(tournamentId)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la génération du bracket'
      throw err
    } finally {
      generating.value = false
    }
  }

  function getRoundLabel(roundNumber: number, totalRounds: number, bracketType: BracketTreeType): string {
    if (bracketType === 'grand_final') return 'Grande Finale'

    const roundsFromEnd = totalRounds - roundNumber + 1
    if (roundsFromEnd === 1) return 'Finale'
    if (roundsFromEnd === 2) return 'Demi-finales'
    if (roundsFromEnd === 3) return 'Quarts de finale'
    if (roundsFromEnd === 4) return 'Huitièmes de finale'

    return `Round ${roundNumber}`
  }

  return {
    matches,
    loading,
    error,
    generating,
    organizedBracket,
    hasMatches,
    isDoubleElimination,
    loadBracket,
    generateBracket,
    getRoundLabel,
  }
}
