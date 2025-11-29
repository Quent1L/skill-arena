import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useTournamentService } from '../tournament/tournament.service'
import { tournamentApi, type TournamentResponse } from '../tournament/tournament.api'
import { useAuth } from '../useAuth'
import type {

  CreateTournamentFormData,
  UpdateTournamentFormData,
} from '@skill-arena/shared/types/index'

vi.mock('@/config/ApiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../tournament/tournament.api')
vi.mock('../useAuth')

describe('useTournamentService', () => {
  const mockCurrentUser = ref({ id: 'user-1', role: 'super_admin' })
  const mockIsSuperAdmin = ref(true)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      currentUser: mockCurrentUser,
      isSuperAdmin: mockIsSuperAdmin,
    } as ReturnType<typeof useAuth>)
  })

  describe('canCreateTournament', () => {
    it('should return true for super admin', () => {
      mockIsSuperAdmin.value = true
      const { canCreateTournament } = useTournamentService()
      expect(canCreateTournament.value).toBe(true)
    })

    it('should return false for regular user', () => {
      mockIsSuperAdmin.value = false
      mockCurrentUser.value = { id: 'user-1', role: 'player' }
      const { canCreateTournament } = useTournamentService()
      expect(canCreateTournament.value).toBe(false)
    })

    it('should return false when no user', () => {
      mockCurrentUser.value = null
      const { canCreateTournament } = useTournamentService()
      expect(canCreateTournament.value).toBe(false)
    })
  })

  describe('canManageTournament', () => {
    it('should return true for super admin', () => {
      mockIsSuperAdmin.value = true
      mockCurrentUser.value = { id: 'user-1', role: 'super_admin' }
      const { canManageTournament } = useTournamentService()
      const tournament = { id: 't-1' } as TournamentResponse
      expect(canManageTournament(tournament)).toBe(true)
    })

    it('should return false for regular user', () => {
      mockIsSuperAdmin.value = false
      mockCurrentUser.value = null
      const { canManageTournament } = useTournamentService()
      const tournament = { id: 't-1' } as TournamentResponse
      expect(canManageTournament(tournament)).toBe(false)
    })
  })

  describe('listTournaments', () => {
    it('should load tournaments successfully', async () => {
      const mockTournaments: TournamentResponse[] = [
        { id: 't-1', name: 'Tournament 1' } as TournamentResponse,
      ]

      vi.mocked(tournamentApi.list).mockResolvedValue(mockTournaments)

      const { listTournaments, tournaments, loading, error } = useTournamentService()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()

      const result = await listTournaments()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(tournamentApi.list).toHaveBeenCalledWith(undefined)
      expect(tournaments.value).toEqual(mockTournaments)
      expect(result).toEqual(mockTournaments)
    })

    it('should handle error when loading tournaments', async () => {
      const mockError = new Error('Failed to load')
      vi.mocked(tournamentApi.list).mockRejectedValue(mockError)

      const { listTournaments, loading, error } = useTournamentService()

      await expect(listTournaments()).rejects.toThrow('Failed to load')
      expect(loading.value).toBe(false)
      expect(error.value).toBe('Failed to load')
    })
  })

  describe('getTournament', () => {
    it('should load tournament successfully', async () => {
      const mockTournament: TournamentResponse = {
        id: 't-1',
        name: 'Tournament 1',
      } as TournamentResponse

      vi.mocked(tournamentApi.getById).mockResolvedValue(mockTournament)

      const { getTournament, currentTournament, loading, error } = useTournamentService()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()

      const result = await getTournament('t-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(tournamentApi.getById).toHaveBeenCalledWith('t-1')
      expect(currentTournament.value).toEqual(mockTournament)
      expect(result).toEqual(mockTournament)
    })

    it('should handle error when loading tournament', async () => {
      const mockError = new Error('Tournament not found')
      vi.mocked(tournamentApi.getById).mockRejectedValue(mockError)

      const { getTournament, loading, error } = useTournamentService()

      await expect(getTournament('t-1')).rejects.toThrow('Tournament not found')
      expect(loading.value).toBe(false)
      expect(error.value).toBe('Tournament not found')
    })
  })

  describe('createTournament', () => {
    it('should create tournament successfully', async () => {
      mockIsSuperAdmin.value = true
      mockCurrentUser.value = { id: 'user-1', role: 'super_admin' }
      const mockTournament: TournamentResponse = {
        id: 't-new',
        name: 'New Tournament',
      } as TournamentResponse

      vi.mocked(tournamentApi.create).mockResolvedValue(mockTournament)

      const { createTournament, tournaments, loading, error } = useTournamentService()

      const formData: CreateTournamentFormData = {
        name: 'New Tournament',
        mode: 'championship',
        teamMode: 'flex',
        minTeamSize: 1,
        maxTeamSize: 2,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
      } as CreateTournamentFormData

      tournaments.value = [{ id: 't-1' } as TournamentResponse]

      const result = await createTournament(formData)

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(tournamentApi.create).toHaveBeenCalled()
      expect(tournaments.value[0]).toEqual(mockTournament)
      expect(result).toEqual(mockTournament)
    })

    it('should throw error when user cannot create', async () => {
      mockIsSuperAdmin.value = false
      const { createTournament } = useTournamentService()

      const formData: CreateTournamentFormData = {
        name: 'New Tournament',
      } as CreateTournamentFormData

      await expect(createTournament(formData)).rejects.toThrow(
        "Vous n'avez pas les droits pour créer un tournoi",
      )
    })
  })

  describe('updateTournament', () => {
    it('should update tournament successfully', async () => {
      const mockTournament: TournamentResponse = {
        id: 't-1',
        name: 'Updated Tournament',
      } as TournamentResponse

      vi.mocked(tournamentApi.update).mockResolvedValue(mockTournament)

      const { updateTournament, tournaments, currentTournament, loading } = useTournamentService()

      tournaments.value = [{ id: 't-1', name: 'Old Name' } as TournamentResponse]
      currentTournament.value = { id: 't-1', name: 'Old Name' } as TournamentResponse

      const formData: UpdateTournamentFormData = {
        name: 'Updated Tournament',
      } as UpdateTournamentFormData

      const result = await updateTournament('t-1', formData)

      expect(loading.value).toBe(false)
      expect(tournamentApi.update).toHaveBeenCalledWith('t-1', expect.any(Object))
      expect(tournaments.value[0]).toEqual(mockTournament)
      expect(currentTournament.value).toEqual(mockTournament)
      expect(result).toEqual(mockTournament)
    })
  })

  describe('changeTournamentStatus', () => {
    it('should change status successfully', async () => {
      const mockTournament: TournamentResponse = {
        id: 't-1',
        status: 'open',
      } as TournamentResponse

      vi.mocked(tournamentApi.changeStatus).mockResolvedValue(mockTournament)

      const { changeTournamentStatus, tournaments, currentTournament } = useTournamentService()

      tournaments.value = [{ id: 't-1', status: 'draft' } as TournamentResponse]
      currentTournament.value = { id: 't-1', status: 'draft' } as TournamentResponse

      const result = await changeTournamentStatus('t-1', 'open')

      expect(tournamentApi.changeStatus).toHaveBeenCalledWith('t-1', 'open')
      expect(tournaments.value[0].status).toBe('open')
      expect(currentTournament.value?.status).toBe('open')
      expect(result.status).toBe('open')
    })
  })

  describe('deleteTournament', () => {
    it('should delete tournament successfully', async () => {
      vi.mocked(tournamentApi.delete).mockResolvedValue({
        success: true,
        message: 'Deleted',
      })

      const { deleteTournament, tournaments, currentTournament, loading } = useTournamentService()

      tournaments.value = [{ id: 't-1' } as TournamentResponse, { id: 't-2' } as TournamentResponse]
      currentTournament.value = { id: 't-1' } as TournamentResponse

      const result = await deleteTournament('t-1')

      expect(loading.value).toBe(false)
      expect(tournamentApi.delete).toHaveBeenCalledWith('t-1')
      expect(tournaments.value).toHaveLength(1)
      expect(tournaments.value[0].id).toBe('t-2')
      expect(currentTournament.value).toBeNull()
      expect(result).toBe(true)
    })
  })

  describe('getAvailableStatusTransitions', () => {
    it('should return correct transitions for draft', () => {
      const { getAvailableStatusTransitions } = useTournamentService()
      const transitions = getAvailableStatusTransitions('draft')
      expect(transitions).toEqual(['open'])
    })

    it('should return correct transitions for open', () => {
      const { getAvailableStatusTransitions } = useTournamentService()
      const transitions = getAvailableStatusTransitions('open')
      expect(transitions).toEqual(['ongoing', 'draft'])
    })

    it('should return correct transitions for ongoing', () => {
      const { getAvailableStatusTransitions } = useTournamentService()
      const transitions = getAvailableStatusTransitions('ongoing')
      expect(transitions).toEqual(['finished'])
    })

    it('should return empty array for finished', () => {
      const { getAvailableStatusTransitions } = useTournamentService()
      const transitions = getAvailableStatusTransitions('finished')
      expect(transitions).toEqual([])
    })
  })
})
