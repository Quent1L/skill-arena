/**
 * Composable pour la gestion des participants aux tournois
 */

import { ref, computed } from 'vue'
import { collections } from '@/utils/pocketbase'
import type {
  TournamentParticipant,
  TournamentParticipantExpanded,
  TournamentParticipantCreate,
  User,
} from '@/types'

export function useParticipants(tournamentId?: string) {
  const participants = ref<TournamentParticipantExpanded[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Récupérer tous les participants d'un tournoi
   */
  const fetchParticipants = async (tourId?: string) => {
    const targetTournamentId = tourId || tournamentId
    if (!targetTournamentId) {
      error.value = 'ID de tournoi manquant'
      return []
    }

    loading.value = true
    error.value = null

    try {
      const records =
        await collections.tournament_participants.getFullList<TournamentParticipantExpanded>({
          filter: `tournament="${targetTournamentId}"`,
          expand: 'user',
          sort: '-created',
          $autoCancel: false,
        })

      participants.value = records
      return participants.value
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du chargement des participants'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Inscrire un utilisateur à un tournoi
   */
  const joinTournament = async (data: TournamentParticipantCreate) => {
    loading.value = true
    error.value = null

    try {
      // Vérifier si déjà inscrit
      const existing = await collections.tournament_participants
        .getFirstListItem<TournamentParticipant>(
          `tournament="${data.tournament}" && user="${data.user}"`,
          { $autoCancel: false },
        )
        .catch(() => null)

      if (existing) {
        throw new Error('Vous êtes déjà inscrit à ce tournoi')
      }

      const participant =
        await collections.tournament_participants.create<TournamentParticipant>(data)

      // Rafraîchir la liste
      if (tournamentId) {
        await fetchParticipants(tournamentId)
      }

      return participant
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de l'inscription au tournoi"
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Se désinscrire d'un tournoi
   */
  const leaveTournament = async (participantId: string) => {
    loading.value = true
    error.value = null

    try {
      await collections.tournament_participants.delete(participantId)

      // Rafraîchir la liste
      if (tournamentId) {
        await fetchParticipants(tournamentId)
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors de la désinscription du tournoi'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Vérifier si un utilisateur participe au tournoi
   */
  const isUserParticipant = (userId: string): boolean => {
    return participants.value.some((p) => p.user === userId)
  }

  /**
   * Obtenir l'inscription d'un utilisateur
   */
  const getUserParticipation = (userId: string): TournamentParticipantExpanded | undefined => {
    return participants.value.find((p) => p.user === userId)
  }

  /**
   * Liste des utilisateurs participants (expanded)
   */
  const participantUsers = computed<User[]>(() => {
    return participants.value.filter((p) => p.expand?.user).map((p) => p.expand!.user!)
  })

  /**
   * Nombre de participants
   */
  const participantCount = computed(() => participants.value.length)

  return {
    participants: computed(() => participants.value),
    participantUsers,
    participantCount,
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchParticipants,
    joinTournament,
    leaveTournament,
    isUserParticipant,
    getUserParticipation,
  }
}
