import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { teamApi } from './team.api'
import type { ClientTeam } from '@skill-arena/shared/types/index'

export function useTeamService() {
  const toast = useToast()
  const teams = ref<ClientTeam[]>([])
  const loading = ref(false)

  async function loadTeams(tournamentId: string): Promise<void> {
    loading.value = true
    try {
      teams.value = await teamApi.list(tournamentId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des équipes'
      toast.add({ severity: 'error', summary: 'Erreur', detail: message, life: 4000 })
    } finally {
      loading.value = false
    }
  }

  async function createTeam(tournamentId: string, name: string): Promise<void> {
    loading.value = true
    try {
      await teamApi.create(tournamentId, { name })
      toast.add({ severity: 'success', summary: 'Succès', detail: 'Équipe créée', life: 3000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création de l'équipe"
      toast.add({ severity: 'error', summary: 'Erreur', detail: message, life: 4000 })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function joinTeam(tournamentId: string, teamId: string, userId?: string): Promise<void> {
    loading.value = true
    try {
      const updated = await teamApi.join(tournamentId, teamId, userId)
      if (updated) {
        const idx = teams.value.findIndex((t) => t.id === teamId)
        if (idx !== -1) teams.value[idx] = updated
      }
      toast.add({ severity: 'success', summary: 'Succès', detail: 'Équipe rejointe', life: 3000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'adhésion"
      toast.add({ severity: 'error', summary: 'Erreur', detail: message, life: 4000 })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function leaveTeam(tournamentId: string, teamId: string): Promise<void> {
    loading.value = true
    try {
      await teamApi.leave(tournamentId, teamId)
      await loadTeams(tournamentId)
      toast.add({ severity: 'info', summary: 'Succès', detail: 'Équipe quittée', life: 3000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors du départ"
      toast.add({ severity: 'error', summary: 'Erreur', detail: message, life: 4000 })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteTeam(tournamentId: string, teamId: string): Promise<void> {
    loading.value = true
    try {
      await teamApi.delete(tournamentId, teamId)
      teams.value = teams.value.filter((t) => t.id !== teamId)
      toast.add({ severity: 'success', summary: 'Succès', detail: 'Équipe supprimée', life: 3000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la suppression"
      toast.add({ severity: 'error', summary: 'Erreur', detail: message, life: 4000 })
      throw err
    } finally {
      loading.value = false
    }
  }

  return { teams, loading, loadTeams, createTeam, joinTeam, leaveTeam, deleteTeam }
}
