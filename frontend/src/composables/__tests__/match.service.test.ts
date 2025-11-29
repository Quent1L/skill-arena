import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMatchService } from '../match/match.service'
import { matchApi } from '../match/match.api'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useParticipantService } from '../participant.service'
import type {
  Match as MatchModel,
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ListMatchesQuery,
  ValidateMatchRequestData,
} from '@skill-arena/shared/types/index'

vi.mock('@/config/ApiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../match/match.api')
vi.mock('vue-router')
vi.mock('primevue/usetoast')
vi.mock('../participant.service')

describe('useMatchService', () => {
  const mockRouter = {
    push: vi.fn(),
  }
  const mockToast = {
    add: vi.fn(),
    remove: vi.fn(),
    removeGroup: vi.fn(),
    removeAllGroups: vi.fn(),
  }
  const mockParticipantService = {
    getTournamentParticipants: vi.fn().mockResolvedValue([]),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue(mockRouter as unknown as ReturnType<typeof useRouter>)
    vi.mocked(useToast).mockReturnValue(mockToast as unknown as ReturnType<typeof useToast>)
    vi.mocked(useParticipantService).mockReturnValue(
      mockParticipantService as unknown as ReturnType<typeof useParticipantService>,
    )
  })

  describe('createMatch', () => {
    it('should call matchApi.create with correct data', async () => {
      const mockMatch: MatchModel = {
        id: 'match-1',
        tournamentId: 'tournament-1',
        status: 'scheduled',
      } as MatchModel

      vi.mocked(matchApi.create).mockResolvedValue(mockMatch)

      const { createMatch } = useMatchService()
      const input: CreateMatchRequestData = {
        tournamentId: 'tournament-1',
        playerIdsA: ['user-1'],
        playerIdsB: ['user-2'],
      }

      const result = await createMatch(input)

      expect(matchApi.create).toHaveBeenCalledWith(input)
      expect(result).toEqual(mockMatch)
    })
  })

  describe('getMatch', () => {
    it('should call matchApi.getById with correct id', async () => {
      const mockMatch: MatchModel = {
        id: 'match-1',
        tournamentId: 'tournament-1',
      } as MatchModel

      vi.mocked(matchApi.getById).mockResolvedValue(mockMatch)

      const { getMatch } = useMatchService()
      const result = await getMatch('match-1')

      expect(matchApi.getById).toHaveBeenCalledWith('match-1')
      expect(result).toEqual(mockMatch)
    })
  })

  describe('listMatches', () => {
    it('should call matchApi.list with filters', async () => {
      const mockMatches: MatchModel[] = [
        { id: 'match-1', tournamentId: 'tournament-1' } as MatchModel,
      ]

      vi.mocked(matchApi.list).mockResolvedValue(mockMatches)

      const { listMatches } = useMatchService()
      const filters: ListMatchesQuery = { tournamentId: 'tournament-1' }
      const result = await listMatches(filters)

      expect(matchApi.list).toHaveBeenCalledWith(filters)
      expect(result).toEqual(mockMatches)
    })

    it('should call matchApi.list without filters', async () => {
      const mockMatches: MatchModel[] = []

      vi.mocked(matchApi.list).mockResolvedValue(mockMatches)

      const { listMatches } = useMatchService()
      const result = await listMatches()

      expect(matchApi.list).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(mockMatches)
    })
  })

  describe('updateMatch', () => {
    it('should call matchApi.update with correct data', async () => {
      const mockMatch: MatchModel = {
        id: 'match-1',
        status: 'reported',
      } as MatchModel

      vi.mocked(matchApi.update).mockResolvedValue(mockMatch)

      const { updateMatch } = useMatchService()
      const input: UpdateMatchRequestData = { status: 'reported', playedAt: new Date().toISOString() }
      const result = await updateMatch('match-1', input)

      expect(matchApi.update).toHaveBeenCalledWith('match-1', input)
      expect(result).toEqual(mockMatch)
    })
  })

  describe('deleteMatch', () => {
    it('should call matchApi.delete with correct id', async () => {
      vi.mocked(matchApi.delete).mockResolvedValue({
        success: true,
        message: 'Match deleted',
      })

      const { deleteMatch } = useMatchService()
      await deleteMatch('match-1')

      expect(matchApi.delete).toHaveBeenCalledWith('match-1')
    })
  })

  describe('reportMatchResult', () => {
    it('should call matchApi.reportResult with correct data', async () => {
      const mockMatch: MatchModel = {
        id: 'match-1',
        status: 'reported',
        scoreA: 2,
        scoreB: 1,
      } as MatchModel

      vi.mocked(matchApi.reportResult).mockResolvedValue(mockMatch)

      const { reportMatchResult } = useMatchService()
      const input: ReportMatchResultRequestData = {
        scoreA: 2,
        scoreB: 1,
      }
      const result = await reportMatchResult('match-1', input)

      expect(matchApi.reportResult).toHaveBeenCalledWith('match-1', input)
      expect(result).toEqual(mockMatch)
    })
  })

  describe('confirmMatchResult', () => {
    it('should call matchApi.confirmResult with correct data', async () => {
      const mockMatch: MatchModel = {
        id: 'match-1',
        status: 'confirmed',
      } as MatchModel

      vi.mocked(matchApi.confirmResult).mockResolvedValue(mockMatch)

      const { confirmMatchResult } = useMatchService()
      const input: ConfirmMatchResultRequestData = { confirmed: true }
      const result = await confirmMatchResult('match-1', input)

      expect(matchApi.confirmResult).toHaveBeenCalledWith('match-1', input)
      expect(result).toEqual(mockMatch)
    })
  })

  describe('validateMatch', () => {
    it('should call matchApi.validate with correct data', async () => {
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: [],
      }

      vi.mocked(matchApi.validate).mockResolvedValue(mockValidation)

      const { validateMatch } = useMatchService()
      const input: ValidateMatchRequestData = {
        tournamentId: 'tournament-1',
        playerIdsA: ['user-1'],
        playerIdsB: ['user-2'],
      }
      const result = await validateMatch(input)

      expect(matchApi.validate).toHaveBeenCalledWith(input)
      expect(result).toEqual(mockValidation)
    })
  })
})
