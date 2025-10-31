/**
 * Composable pour la gestion des équipes
 */

import { ref, computed } from 'vue'
import { collections } from '@/utils/pocketbase'
import type { Team, TeamExpanded, TeamCreate, TeamUpdate } from '@/types'

export function useTeams(tournamentId?: string) {
  const teams = ref<TeamExpanded[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Récupérer toutes les équipes d'un tournoi
   */
  const fetchTeams = async (tourId?: string) => {
    const targetTournamentId = tourId || tournamentId
    if (!targetTournamentId) {
      error.value = 'ID de tournoi manquant'
      return []
    }

    loading.value = true
    error.value = null

    try {
      const records = await collections.teams.getFullList<TeamExpanded>({
        filter: `tournament="${targetTournamentId}"`,
        expand: 'players',
        sort: '-created',
        $autoCancel: false,
      })

      teams.value = records
      return teams.value
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du chargement des équipes'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Récupérer une équipe par son ID
   */
  const fetchTeam = async (teamId: string) => {
    loading.value = true
    error.value = null

    try {
      const team = await collections.teams.getOne<TeamExpanded>(teamId, {
        expand: 'players',
        $autoCancel: false,
      })

      return team
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors du chargement de l'équipe"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Créer une nouvelle équipe
   */
  const createTeam = async (data: TeamCreate) => {
    loading.value = true
    error.value = null

    try {
      // Validation : le nom n'est requis que pour les équipes multi-joueurs
      if (data.players.length > 1 && !data.name?.trim()) {
        throw new Error("Le nom de l'équipe est requis pour les équipes multi-joueurs")
      }

      // Si équipe solo et pas de nom, on laisse PocketBase gérer (sera null/undefined)
      const teamData = { ...data }
      if (data.players.length === 1 && !data.name) {
        delete teamData.name
      }

      const team = await collections.teams.create<Team>(teamData)
      await fetchTeams(data.tournament)
      return team
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de la création de l'équipe"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Mettre à jour une équipe
   */
  const updateTeam = async (teamId: string, data: TeamUpdate) => {
    loading.value = true
    error.value = null

    try {
      const team = await collections.teams.update<Team>(teamId, data)

      // Rafraîchir la liste si on a un tournamentId
      if (tournamentId) {
        await fetchTeams(tournamentId)
      }

      return team
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de la mise à jour de l'équipe"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Supprimer une équipe
   */
  const deleteTeam = async (teamId: string) => {
    loading.value = true
    error.value = null

    try {
      await collections.teams.delete(teamId)

      // Rafraîchir la liste si on a un tournamentId
      if (tournamentId) {
        await fetchTeams(tournamentId)
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de la suppression de l'équipe"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Équipes de l'utilisateur connecté
   */
  const userTeams = (userId: string) => {
    return computed(() => teams.value.filter((team) => team.players.includes(userId)))
  }

  return {
    teams: computed(() => teams.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchTeams,
    fetchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    userTeams,
  }
}
