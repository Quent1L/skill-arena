import { ref } from 'vue'
import { participantApi } from './participant.api'
import { useToast } from 'primevue/usetoast'
import type { JoinTournamentResponse, ParticipantListItem } from '@skill-arena/shared'

export function useParticipantService() {
  const toast = useToast()

  // State
  const participants = ref<ParticipantListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function joinTournament(tournamentId: string): Promise<JoinTournamentResponse | null> {
    try {
      loading.value = true
      error.value = null

      const result = await participantApi.joinTournament(tournamentId)

      toast.add({
        severity: 'success',
        summary: 'Inscription réussie',
        detail: 'Vous êtes maintenant inscrit au tournoi',
        life: 3000,
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'inscription"
      error.value = message

      toast.add({
        severity: 'error',
        summary: "Erreur d'inscription",
        detail: message,
        life: 5000,
      })

      return null
    } finally {
      loading.value = false
    }
  }

  async function leaveTournament(tournamentId: string): Promise<boolean> {
    try {
      loading.value = true
      error.value = null

      await participantApi.leaveTournament(tournamentId)

      toast.add({
        severity: 'success',
        summary: 'Désinscription réussie',
        detail: 'Vous avez quitté le tournoi',
        life: 3000,
      })

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la désinscription'
      error.value = message

      toast.add({
        severity: 'error',
        summary: 'Erreur de désinscription',
        detail: message,
        life: 5000,
      })

      return false
    } finally {
      loading.value = false
    }
  }

  async function getTournamentParticipants(tournamentId: string): Promise<ParticipantListItem[]> {
    try {
      loading.value = true
      error.value = null

      const result = await participantApi.getTournamentParticipants(tournamentId)
      participants.value = result

      return result
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors du chargement des participants'
      error.value = message

      console.error('Erreur lors du chargement des participants:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    participants,
    loading,
    error,

    // Actions
    joinTournament,
    leaveTournament,
    getTournamentParticipants,
  }
}
