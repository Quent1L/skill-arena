import { ref, computed } from 'vue'
import { tournamentApi, type TournamentResponse } from './tournament.api'
import type {
  CreateTournamentFormData,
  UpdateTournamentFormData,
} from '@/schemas/tournament.schema'
import { toApiPayload } from '@/schemas/tournament.schema'
import { useAuth } from './useAuth'
import { is } from 'date-fns/locale'

// Type guard for checking if user has role property
interface UserWithRole {
  role?: 'player' | 'tournament_admin' | 'super_admin'
}

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
    const user = currentUser.value as UserWithRole
    // Match backend logic - only tournament_admin or super_admin can create
    return isSuperAdmin.value
  })

  /**
   * Check if current user can manage a specific tournament
   */
  function canManageTournament(tournament: TournamentResponse): boolean {
    if (!currentUser.value) return false

    if (isSuperAdmin.value) return true

    // Check if user is in the tournament admins
    return tournament.admins?.some((admin) => admin.user.id === currentUser.value?.id) ?? false
  }

  /**
   * Check if user can delete tournament
   */
  function canDeleteTournament(tournament: TournamentResponse): boolean {
    if (!currentUser.value) return false

    if (isSuperAdmin.value) return true

    // Owner can delete (but only if draft)
    const isOwner =
      tournament.admins?.some(
        (admin) => admin.user.id === currentUser.value?.id && admin.role === 'owner',
      ) ?? false

    return isOwner && tournament.status === 'draft'
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
    status?: 'draft' | 'open' | 'ongoing' | 'finished'
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
      const payload = toApiPayload(formData)
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
      const payload = toApiPayload(formData)
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
  async function changeTournamentStatus(
    id: string,
    status: 'draft' | 'open' | 'ongoing' | 'finished',
  ) {
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
  function getAvailableStatusTransitions(
    currentStatus: 'draft' | 'open' | 'ongoing' | 'finished',
  ): Array<'draft' | 'open' | 'ongoing' | 'finished'> {
    const transitions: Record<string, Array<'draft' | 'open' | 'ongoing' | 'finished'>> = {
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
