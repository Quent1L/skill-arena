/**
 * Composable pour la gestion des matchs
 */

import { ref, computed } from 'vue'
import { collections } from '@/utils/pocketbase'
import { useAuth } from './useAuth'
import type { Match, MatchExpanded, MatchWithStatus, ScoreSubmission, User } from '@/types'

export function useMatches(tournamentId?: string) {
  const { currentUser } = useAuth()
  const matches = ref<MatchWithStatus[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Récupérer les matchs d'un tournoi
   */
  const fetchMatches = async (tid?: string) => {
    const targetTournamentId = tid || tournamentId
    if (!targetTournamentId) {
      error.value = 'ID de tournoi manquant'
      return
    }

    loading.value = true
    error.value = null

    try {
      const records = await collections.matches.getFullList<MatchExpanded>({
        filter: `tournament = "${targetTournamentId}"`,
        expand: 'teamA,teamB,teamA.players,teamB.players,winner,validated_by',
        sort: '-played_at',
        $autoCancel: false,
      })

      matches.value = records.map((match) => enrichMatch(match))
      return matches.value
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du chargement des matchs'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Récupérer un match par ID
   */
  const fetchMatch = async (matchId: string) => {
    loading.value = true
    error.value = null

    try {
      const match = await collections.matches.getOne<MatchExpanded>(matchId, {
        expand: 'teamA,teamB,teamA.players,teamB.players,winner,validated_by',
        $autoCancel: false,
      })

      return enrichMatch(match)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement du match'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Soumettre un score pour un match
   */
  const submitScore = async (submission: ScoreSubmission) => {
    loading.value = true
    error.value = null

    try {
      const match = await collections.matches.getOne<MatchExpanded>(submission.matchId, {
        expand: 'teamA,teamB',
      })

      // Déterminer le gagnant
      let winner: string | undefined
      if (submission.scoreA > submission.scoreB) {
        winner = match.teamA
      } else if (submission.scoreB > submission.scoreA) {
        winner = match.teamB
      }

      // Mettre à jour le match
      const updated = await collections.matches.update<Match>(submission.matchId, {
        scoreA: submission.scoreA,
        scoreB: submission.scoreB,
        winner,
        validated_by: currentUser.value?.id,
        notes: submission.notes,
      })

      await fetchMatches(tournamentId)
      return updated
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la soumission du score'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Créer un nouveau match
   */
  const createMatch = async (data: {
    tournament: string
    teamA: string
    teamB: string
    played_at?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      // Validation
      if (data.teamA === data.teamB) {
        throw new Error('Les deux équipes doivent être différentes')
      }

      // Créer le match avec des valeurs par défaut
      const match = await collections.matches.create<Match>({
        tournament: data.tournament,
        teamA: data.teamA,
        teamB: data.teamB,
        scoreA: 0,
        scoreB: 0,
        played_at: data.played_at || new Date().toISOString(),
      })

      // Rafraîchir la liste
      await fetchMatches(data.tournament)
      return match
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la création du match'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Vérifier si deux équipes peuvent s'affronter
   * @param teamAId ID de l'équipe A
   * @param teamBId ID de l'équipe B
   * @param limit Limite de confrontations (undefined = pas de limite)
   * @returns true si les équipes peuvent s'affronter
   */
  const canTeamsPlay = (teamAId: string, teamBId: string, limit?: number): boolean => {
    if (!limit || limit <= 0) return true

    // Compter les matchs existants entre ces deux équipes
    const existingMatches = matches.value.filter((m) => {
      return (
        (m.teamA === teamAId && m.teamB === teamBId) || (m.teamA === teamBId && m.teamB === teamAId)
      )
    })

    return existingMatches.length < limit
  }

  /**
   * Enrichir un match avec statut et permissions
   */
  const enrichMatch = (match: MatchExpanded): MatchWithStatus => {
    const hasScore =
      match.scoreA !== null &&
      match.scoreB !== null &&
      match.scoreA !== undefined &&
      match.scoreB !== undefined
    const isValidated = !!match.validated_by

    let status: 'pending' | 'pending_confirmation' | 'played' = 'pending'
    if (isValidated) {
      status = 'played'
    } else if (hasScore) {
      status = 'pending_confirmation'
    }

    // Vérifier si l'utilisateur peut éditer ce match
    const canEdit = currentUser.value
      ? isUserInMatch(match, currentUser.value.id) && !isValidated
      : false

    const canValidate = canEdit && hasScore

    return {
      ...match,
      status,
      canEdit,
      canValidate,
    }
  }

  /**
   * Vérifier si un utilisateur participe au match
   */
  const isUserInMatch = (match: MatchExpanded, userId: string): boolean => {
    const teamAPlayers = match.expand?.teamA?.expand?.players || []
    const teamBPlayers = match.expand?.teamB?.expand?.players || []

    return (
      teamAPlayers.some((p: User) => p.id === userId) ||
      teamBPlayers.some((p: User) => p.id === userId)
    )
  }

  /**
   * Matchs en attente
   */
  const pendingMatches = computed(() => matches.value.filter((m) => m.status === 'pending'))

  /**
   * Matchs en attente de confirmation
   */
  const pendingConfirmationMatches = computed(() =>
    matches.value.filter((m) => m.status === 'pending_confirmation'),
  )

  /**
   * Matchs joués
   */
  const playedMatches = computed(() => matches.value.filter((m) => m.status === 'played'))

  /**
   * Matchs de l'utilisateur courant
   */
  const userMatches = computed(() => {
    if (!currentUser.value) return []
    return matches.value.filter((m) => isUserInMatch(m, currentUser.value!.id))
  })

  return {
    matches: computed(() => matches.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    pendingMatches,
    pendingConfirmationMatches,
    playedMatches,
    userMatches,
    fetchMatches,
    fetchMatch,
    submitScore,
    createMatch,
    canTeamsPlay,
  }
}
