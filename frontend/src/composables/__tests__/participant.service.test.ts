import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useParticipantService } from '../participant.service'
import { participantApi } from '../participant.api'
import { useToast } from 'primevue/usetoast'
import type { JoinTournamentResponse, ParticipantListItem } from '@skill-arena/shared/types/index'

vi.mock('@/config/ApiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../participant.api')
vi.mock('primevue/usetoast')

describe('useParticipantService', () => {
  const mockToast = {
    add: vi.fn(),
    remove: vi.fn(),
    removeGroup: vi.fn(),
    removeAllGroups: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useToast).mockReturnValue(mockToast as unknown as ReturnType<typeof useToast>)
  })

  describe('joinTournament', () => {
    it('should join tournament successfully', async () => {
      const mockResponse: JoinTournamentResponse = {
        id: 'participation-1',
        tournamentId: 'tournament-1',
        userId: 'user-1',
      } as JoinTournamentResponse

      vi.mocked(participantApi.joinTournament).mockResolvedValue(mockResponse)

      const { joinTournament, loading, error } = useParticipantService()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()

      const result = await joinTournament('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(participantApi.joinTournament).toHaveBeenCalledWith('tournament-1')
      expect(result).toEqual(mockResponse)
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Inscription réussie',
        detail: 'Vous êtes maintenant inscrit au tournoi',
        life: 3000,
      })
    })

    it('should handle error when joining tournament', async () => {
      const mockError = new Error('Tournament not found')
      vi.mocked(participantApi.joinTournament).mockRejectedValue(mockError)

      const { joinTournament, loading, error } = useParticipantService()

      const result = await joinTournament('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBe('Tournament not found')
      expect(result).toBeNull()
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: "Erreur d'inscription",
        detail: 'Tournament not found',
        life: 5000,
      })
    })
  })

  describe('leaveTournament', () => {
    it('should leave tournament successfully', async () => {
      vi.mocked(participantApi.leaveTournament).mockResolvedValue({
        message: 'Vous avez quitté le tournoi',
      })

      const { leaveTournament, loading, error } = useParticipantService()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()

      const result = await leaveTournament('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(participantApi.leaveTournament).toHaveBeenCalledWith('tournament-1')
      expect(result).toBe(true)
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Désinscription réussie',
        detail: 'Vous avez quitté le tournoi',
        life: 3000,
      })
    })

    it('should handle error when leaving tournament', async () => {
      const mockError = new Error('Not registered')
      vi.mocked(participantApi.leaveTournament).mockRejectedValue(mockError)

      const { leaveTournament, loading, error } = useParticipantService()

      const result = await leaveTournament('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBe('Not registered')
      expect(result).toBe(false)
      expect(mockToast.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Erreur de désinscription',
        detail: 'Not registered',
        life: 5000,
      })
    })
  })

  describe('getTournamentParticipants', () => {
    it('should load participants successfully', async () => {
      const mockParticipants: ParticipantListItem[] = [
        {
          id: 'part-1',
          userId: 'user-1',
          tournamentId: 'tournament-1',
          teamId: null,
          matchesPlayed: 0,
          joinedAt: new Date(),
          user: { id: 'user-1', displayName: 'User 1' },
        } as ParticipantListItem,
      ]

      vi.mocked(participantApi.getTournamentParticipants).mockResolvedValue(
        mockParticipants,
      )

      const { getTournamentParticipants, participants, loading, error } =
        useParticipantService()

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()

      const result = await getTournamentParticipants('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(participantApi.getTournamentParticipants).toHaveBeenCalledWith(
        'tournament-1',
      )
      expect(participants.value).toEqual(mockParticipants)
      expect(result).toEqual(mockParticipants)
    })

    it('should handle error when loading participants', async () => {
      const mockError = new Error('Failed to load')
      vi.mocked(participantApi.getTournamentParticipants).mockRejectedValue(
        mockError,
      )

      const { getTournamentParticipants, participants, loading, error } =
        useParticipantService()

      const result = await getTournamentParticipants('tournament-1')

      expect(loading.value).toBe(false)
      expect(error.value).toBe('Failed to load')
      expect(result).toEqual([])
      expect(participants.value).toEqual([])
    })
  })
})

