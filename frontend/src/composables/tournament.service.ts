import { ref, computed } from 'vue'
import {
  tournamentApi,
  type TournamentResponse,
  type CreateTournamentPayload,
} from './tournament.api'
import type {
  CreateTournamentFormData,
  UpdateTournamentFormData,
  TournamentStatus,
} from '@skill-arena/shared'
import { formDataToApiPayload } from '@skill-arena/shared'
import { useAuth } from './useAuth'

/**
 * Tournament service - Business logic and state management
 */
export function useTournamentService() {
  const { currentUser, isSuperAdmin } = useAuth()

  const tournaments = ref<TournamentResponse[]>([])
  const currentTournament = ref<TournamentResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Check if current user can create tournaments
   */
  const canCreateTournament = computed(() => {
    if (!currentUser.value) return false
    // Match backend logic - only tournament_admin or super_admin can create
    return isSuperAdmin.value
  })

  /**
   * Check if current user can manage a specific tournament
   */
  function canManageTournament(tournament: TournamentResponse): boolean {
    if (!currentUser.value) return false

    if (isSuperAdmin.value) return true

    // TODO: Implement when tournament admins are available in BaseTournament
    // Check if user is in the tournament admins
    // return tournament.admins?.some((admin) => admin.user.id === currentUser.value?.id) ?? false

    // For now, only super admin can manage
    return false
  }

  /**
   * Check if user can delete tournament
   */
  function canDeleteTournament(tournament: TournamentResponse): boolean {
    if (!currentUser.value) return false

    if (isSuperAdmin.value) return true

    // TODO: Implement when tournament admins are available
    // Owner can delete (but only if draft)
    // const isOwner =
    //   tournament.admins?.some(
    //     (admin) => admin.user.id === currentUser.value?.id && admin.role === 'owner',
    //   ) ?? false

    // return isOwner && tournament.status === 'draft'

    // For now, only super admin can delete drafts
    return tournament.status === 'draft'
  }

  /**
   * Check if tournament can be edited
   */
  function canEditTournament(tournament: TournamentResponse): boolean {
    if (!canManageTournament(tournament)) return false

    // After draft, only certain fields can be edited
    return true // Service handles the restriction
  }

  /**
   * Check what fields can be edited based on status
   */
  function getEditableFields(tournament: TournamentResponse): string[] {
    if (tournament.status === 'draft') {
      return ['all'] // All fields editable
    }
    // After draft, only these fields
    return ['description', 'startDate', 'endDate', 'status']
  }

  /**
   * List tournaments with optional filters
   */
  async function listTournaments(filters?: {
    status?: TournamentStatus
    mode?: 'championship' | 'bracket'
  }) {
    loading.value = true
    error.value = null

    try {
      tournaments.value = await tournamentApi.list(filters)
      return tournaments.value
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get tournament by ID
   */
  async function getTournament(id: string) {
    loading.value = true
    error.value = null

    try {
      currentTournament.value = await tournamentApi.getById(id)
      return currentTournament.value
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create tournament
   */
  async function createTournament(formData: CreateTournamentFormData) {
    if (!canCreateTournament.value) {
      throw new Error("Vous n'avez pas les droits pour créer un tournoi")
    }

    loading.value = true
    error.value = null

    try {
      const payload = formDataToApiPayload(formData) as CreateTournamentPayload
      const tournament = await tournamentApi.create(payload)

      // Add to list if already loaded
      if (tournaments.value.length > 0) {
        tournaments.value.unshift(tournament)
      }

      return tournament
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update tournament
   */
  async function updateTournament(id: string, formData: UpdateTournamentFormData) {
    loading.value = true
    error.value = null

    try {
      const payload = formDataToApiPayload(formData)
      const tournament = await tournamentApi.update(id, payload)

      // Update in list
      const index = tournaments.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        tournaments.value[index] = tournament
      }

      // Update current
      if (currentTournament.value?.id === id) {
        currentTournament.value = tournament
      }

      return tournament
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la mise à jour'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Change tournament status
   */
  async function changeTournamentStatus(id: string, status: TournamentStatus) {
    loading.value = true
    error.value = null

    try {
      const tournament = await tournamentApi.changeStatus(id, status)

      // Update in list
      const index = tournaments.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        tournaments.value[index] = tournament
      }

      // Update current
      if (currentTournament.value?.id === id) {
        currentTournament.value = tournament
      }

      return tournament
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du changement de statut'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete tournament
   */
  async function deleteTournament(id: string) {
    loading.value = true
    error.value = null

    try {
      await tournamentApi.delete(id)

      // Remove from list
      tournaments.value = tournaments.value.filter((t) => t.id !== id)

      // Clear current if it's the deleted one
      if (currentTournament.value?.id === id) {
        currentTournament.value = null
      }

      return true
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la suppression'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get available status transitions
   */
  function getAvailableStatusTransitions(currentStatus: TournamentStatus): TournamentStatus[] {
    const transitions: Record<string, TournamentStatus[]> = {
      draft: ['open'],
      open: ['ongoing', 'draft'],
      ongoing: ['finished'],
      finished: [],
    }
    return transitions[currentStatus] || []
  }

  return {
    // State
    tournaments,
    currentTournament,
    loading,
    error,

    // Computed
    canCreateTournament,

    // Methods
    canManageTournament,
    canDeleteTournament,
    canEditTournament,
    getEditableFields,
    getAvailableStatusTransitions,
    listTournaments,
    getTournament,
    createTournament,
    updateTournament,
    changeTournamentStatus,
    deleteTournament,
  }
}
