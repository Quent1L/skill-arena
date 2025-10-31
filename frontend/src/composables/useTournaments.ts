/**
 * Composable pour la gestion des tournois
 * Utilise Eden Treaty pour une API type-safe
 */

import { ref, computed } from 'vue'
import type { Tournament, TournamentCreate, TournamentUpdate } from '@skill-arena/shared'
import { api } from '@skill-arena/shared/api-client'

export function useTournaments() {
  const tournaments = ref<Tournament[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Récupérer tous les tournois
   */
  const fetchTournaments = async () => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await api.api.tournaments.get()

      if (apiError) {
        throw new Error('Erreur lors du chargement des tournois')
      }

      tournaments.value = data.tournaments || []
      return tournaments.value
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du chargement des tournois'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Récupérer un tournoi par son ID
   */
  const fetchTournament = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await api.api.tournaments({ id }).get()

      if (apiError) {
        throw new Error('Erreur lors du chargement du tournoi')
      }

      return data.tournament
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du chargement du tournoi'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Créer un nouveau tournoi (admin uniquement)
   */
  const createTournament = async (tournamentData: TournamentCreate) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await api.api.tournaments.post(tournamentData)

      if (apiError) {
        throw new Error('Erreur lors de la création du tournoi')
      }

      await fetchTournaments() // Rafraîchir la liste
      return data.tournament
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la création du tournoi'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Mettre à jour un tournoi
   */
  const updateTournament = async (id: string, tournamentData: TournamentUpdate) => {
    loading.value = true
    error.value = null

    try {
      const { data, error: apiError } = await api.api.tournaments({ id }).patch(tournamentData)

      if (apiError) {
        throw new Error('Erreur lors de la mise à jour du tournoi')
      }

      await fetchTournaments() // Rafraîchir la liste
      return data.tournament
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour du tournoi'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Supprimer un tournoi
   */
  const deleteTournament = async (id: string) => {
    loading.value = true
    error.value = null

    try {
      const { error: apiError } = await api.api.tournaments({ id }).delete()

      if (apiError) {
        throw new Error('Erreur lors de la suppression du tournoi')
      }

      await fetchTournaments() // Rafraîchir la liste
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la suppression du tournoi'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Obtenir le statut d'un tournoi
   */
  const getTournamentStatus = (tournament: Tournament): 'upcoming' | 'active' | 'finished' => {
    const now = new Date()
    const start = new Date(tournament.start_date)
    const end = new Date(tournament.end_date)

    if (now < start) return 'upcoming'
    if (now > end) return 'finished'
    return 'active'
  }

  /**
   * Tournois actifs
   */
  const activeTournaments = computed(() =>
    tournaments.value.filter((t) => getTournamentStatus(t) === 'active'),
  )

  /**
   * Tournois à venir
   */
  const upcomingTournaments = computed(() =>
    tournaments.value.filter((t) => getTournamentStatus(t) === 'upcoming'),
  )

  /**
   * Tournois terminés
   */
  const finishedTournaments = computed(() =>
    tournaments.value.filter((t) => getTournamentStatus(t) === 'finished'),
  )

  return {
    tournaments: computed(() => tournaments.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    activeTournaments,
    upcomingTournaments,
    finishedTournaments,
    fetchTournaments,
    fetchTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    getTournamentStatus,
  }
}
