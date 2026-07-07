import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, inject, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useRoute } from 'vue-router'
import { mountWithPrime } from '@/test-support/mount'
import { makeAuthMock, type AuthMockState } from '@/test-support/mock-modules'
import { makeTournament } from '@/test-support/factories'
import { useAuth } from '@/composables/useAuth'
import { useViewport } from '@/composables/useViewport'
import { useAppToast } from '@/composables/useAppToast'
import { useMatchService } from '@/composables/match/match.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useTeamService } from '@/composables/team/team.service'
import { useParticipantService } from '@/composables/participant.service'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { disciplineApi } from '@/composables/discipline/discipline.api'
import { MATCH_FORM_KEY, type MatchFormContext } from '@/composables/match/match-form.context'
import CreateMatchView from '../CreateMatchView.vue'
import type {
  BaseTournament,
  ClientBaseTournament,
  ClientMatchDetail,
  ParticipantListItem,
  OutcomeType,
  Discipline,
  MatchStatus,
} from '@skol-arena/shared'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key }, install: () => {} }),
}))
vi.mock('vue-router', () => ({ useRoute: vi.fn() }))
vi.mock('@/composables/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('@/composables/useViewport', () => ({ useViewport: vi.fn() }))
vi.mock('@/composables/useAppToast', () => ({ useAppToast: vi.fn() }))
vi.mock('@/composables/match/match.service', () => ({ useMatchService: vi.fn() }))
vi.mock('@/composables/tournament/tournament.service', () => ({ useTournamentService: vi.fn() }))
vi.mock('@/composables/team/team.service', () => ({ useTeamService: vi.fn() }))
vi.mock('@/composables/participant.service', () => ({ useParticipantService: vi.fn() }))
vi.mock('@/composables/outcome-type.api')
vi.mock('@/composables/outcome-reason.api')
vi.mock('@/composables/discipline/discipline.api')

function makeClientTournament(over: Partial<ClientBaseTournament> = {}): ClientBaseTournament {
  const base = makeTournament(over as Partial<BaseTournament>)
  return {
    ...base,
    startDate: new Date(base.startDate),
    endDate: new Date(base.endDate),
    createdAt: new Date(base.createdAt),
    updatedAt: new Date(base.updatedAt),
    ...over,
  } as ClientBaseTournament
}

function makeParticipant(userId: string, displayName: string): ParticipantListItem {
  return {
    id: `p-${userId}`,
    userId,
    teamId: null,
    matchesPlayed: 0,
    joinedAt: new Date('2026-01-01'),
    user: { id: userId, displayName, role: 'player' },
  }
}

function makeOutcomeType(over: Partial<OutcomeType> = {}): OutcomeType {
  return {
    id: 'ot-1',
    disciplineId: 'd1',
    name: 'Normal',
    isDefault: false,
    scoreCountsForMmr: true,
    points: 3,
    mmrMultiplier: 1,
    ...over,
  }
}

function makeMatchDetail(over: Partial<ClientMatchDetail> = {}): ClientMatchDetail {
  return {
    id: 'm1',
    tournamentId: 't1',
    status: 'reported' as MatchStatus,
    playedAt: new Date('2026-06-01'),
    createdAt: new Date('2026-06-01'),
    outcomeTypeId: 'ot-1',
    outcomeReasonId: null,
    sides: [
      {
        position: 1,
        score: 3,
        pointsAwarded: 3,
        isWinner: true,
        entryId: 'e1',
        entryName: null,
        players: [{ id: 'u1', displayName: 'Alice', shortName: 'AL' }],
      },
      {
        position: 2,
        score: 1,
        pointsAwarded: 0,
        isWinner: false,
        entryId: 'e2',
        entryName: null,
        players: [{ id: 'u2', displayName: 'Bob', shortName: 'BO' }],
      },
    ],
    ...over,
  } as ClientMatchDetail
}

function makeProbe(name: string) {
  return defineComponent({
    name,
    props: { tournamentId: String, matchId: String, bracketLocked: Boolean },
    setup() {
      return { ...(inject(MATCH_FORM_KEY) as MatchFormContext) }
    },
    template: '<div />',
  })
}
const MobileProbe = makeProbe('MobileProbe')
const DesktopProbe = makeProbe('DesktopProbe')

function getProbe(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const mobile = wrapper.findComponent(MobileProbe)
  return mobile.exists() ? mobile : wrapper.findComponent(DesktopProbe)
}

let loadTournamentMock: ReturnType<typeof vi.fn>
let loadPlayersMapMock: ReturnType<typeof vi.fn>
let getMatchMock: ReturnType<typeof vi.fn>
let loadTeamsMock: ReturnType<typeof vi.fn>
let getParticipantsMock: ReturnType<typeof vi.fn>
let toastAddMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(useViewport).mockReturnValue({ width: ref(1280), isMobile: ref(false) })

  toastAddMock = vi.fn()
  vi.mocked(useAppToast).mockReturnValue({ add: toastAddMock } as unknown as ReturnType<
    typeof useAppToast
  >)

  loadTournamentMock = vi.fn().mockResolvedValue(makeClientTournament())
  vi.mocked(useTournamentService).mockReturnValue({
    loadTournamentWithErrorHandling: loadTournamentMock,
  } as unknown as ReturnType<typeof useTournamentService>)

  loadPlayersMapMock = vi.fn().mockResolvedValue({})
  getMatchMock = vi.fn()
  vi.mocked(useMatchService).mockReturnValue({
    playersMap: ref({}),
    loadPlayersMap: loadPlayersMapMock,
    getMatch: getMatchMock,
  } as unknown as ReturnType<typeof useMatchService>)

  loadTeamsMock = vi.fn().mockResolvedValue(undefined)
  vi.mocked(useTeamService).mockReturnValue({
    teams: ref([]),
    loadTeams: loadTeamsMock,
  } as unknown as ReturnType<typeof useTeamService>)

  getParticipantsMock = vi.fn().mockResolvedValue([
    makeParticipant('u1', 'Alice'),
    makeParticipant('u2', 'Bob'),
  ])
  vi.mocked(useParticipantService).mockReturnValue({
    getTournamentParticipants: getParticipantsMock,
  } as unknown as ReturnType<typeof useParticipantService>)

  vi.mocked(outcomeTypeApi.list).mockResolvedValue([
    makeOutcomeType({ id: 'ot-default', isDefault: true }),
  ])
  vi.mocked(outcomeReasonApi.list).mockResolvedValue([])
  vi.mocked(disciplineApi.getById).mockResolvedValue({
    id: 'd1',
    name: 'Chess',
    scoreInstructions: 'Enter final score',
  } as Discipline)
})

async function mountView(
  routeOverrides: { tournamentId?: string; matchId?: string } = {},
  authOverrides: Partial<AuthMockState> = {},
) {
  vi.mocked(useRoute).mockReturnValue({
    params: { tournamentId: routeOverrides.tournamentId ?? 't1' },
    query: { matchId: routeOverrides.matchId },
  } as unknown as ReturnType<typeof useRoute>)

  vi.mocked(useAuth).mockReturnValue(
    makeAuthMock({
      user: { id: 'u1', email: 'u1@test.dev' },
      role: 'player',
      initialized: true,
      ...authOverrides,
    }) as unknown as ReturnType<typeof useAuth>,
  )

  const wrapper = mountWithPrime(CreateMatchView, {
    global: {
      stubs: { MatchFormStepperMobile: MobileProbe, MatchFormStepperDesktop: DesktopProbe },
    },
  })
  await flushPromises()
  return wrapper
}

describe('CreateMatchView', () => {
  it('charge tournoi, playersMap, participants puis données de résultat au montage', async () => {
    await mountView()
    expect(loadTournamentMock).toHaveBeenCalledWith('t1')
    expect(loadPlayersMapMock).toHaveBeenCalledWith('t1')
    expect(getParticipantsMock).toHaveBeenCalledWith('t1')
    expect(outcomeTypeApi.list).toHaveBeenCalled()
  })

  it('isLoading passe à false une fois le montage terminé', async () => {
    const wrapper = await mountView()
    expect(getProbe(wrapper).vm.isLoading).toBe(false)
  })

  it('mode static: charge les équipes et ne charge pas les participants', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ teamMode: 'static' }))
    await mountView()
    expect(loadTeamsMock).toHaveBeenCalledWith('t1')
    expect(getParticipantsMock).not.toHaveBeenCalled()
  })

  it('mode flex: charge les participants et ne charge pas les équipes', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ teamMode: 'flex' }))
    await mountView()
    expect(getParticipantsMock).toHaveBeenCalledWith('t1')
    expect(loadTeamsMock).not.toHaveBeenCalled()
  })

  it('utilisateur non-admin participant: auto-ajouté à allPlayerIds', async () => {
    const wrapper = await mountView({}, { role: 'player' })
    expect(getProbe(wrapper).vm.formState.allPlayerIds).toEqual(['u1'])
  })

  it('utilisateur admin: pas auto-ajouté à allPlayerIds', async () => {
    const wrapper = await mountView({}, { role: 'tournament_admin' })
    expect(getProbe(wrapper).vm.formState.allPlayerIds).toEqual([])
  })

  it('utilisateur non participant: pas auto-ajouté à allPlayerIds', async () => {
    const wrapper = await mountView({}, { user: { id: 'u9', email: 'u9@test.dev' }, role: 'player' })
    expect(getProbe(wrapper).vm.formState.allPlayerIds).toEqual([])
  })

  it('édition avec matchId: allPlayerIds reflète les joueurs du match, pas l’auto-ajout', async () => {
    getMatchMock.mockResolvedValue(makeMatchDetail())
    const wrapper = await mountView({ matchId: 'm1' }, { role: 'player' })
    expect(getProbe(wrapper).vm.formState.allPlayerIds).toEqual(['u1', 'u2'])
  })

  it('matchId présent: appelle getMatch et peuple le formState', async () => {
    getMatchMock.mockResolvedValue(makeMatchDetail())
    const wrapper = await mountView({ matchId: 'm1' })
    expect(getMatchMock).toHaveBeenCalledWith('m1')
    const formState = getProbe(wrapper).vm.formState
    expect(formState.playedAt).toEqual(new Date('2026-06-01'))
    expect(formState.scorePerSide).toEqual({ 1: 3, 2: 1 })
    expect(formState.outcomeTypeId).toBe('ot-1')
    expect(formState.outcomeReasonId).toBeNull()
    expect(formState.winnerPosition).toBe(1)
    expect(formState.sides).toEqual([
      { position: 1, playerIds: ['u1'] },
      { position: 2, playerIds: ['u2'] },
    ])
  })

  it.each(['reported', 'pending_confirmation'] as const)(
    'statut %s: activeStep passe à "result"',
    async (status) => {
      getMatchMock.mockResolvedValue(makeMatchDetail({ status }))
      const wrapper = await mountView({ matchId: 'm1' })
      expect(getProbe(wrapper).vm.activeStep).toBe('result')
    },
  )

  it('statut scheduled: activeStep reste "when"', async () => {
    getMatchMock.mockResolvedValue(makeMatchDetail({ status: 'scheduled' }))
    const wrapper = await mountView({ matchId: 'm1' })
    expect(getProbe(wrapper).vm.activeStep).toBe('when')
  })

  it('getMatch échoue: affiche un toast d’erreur sans planter', async () => {
    getMatchMock.mockRejectedValue(new Error('boom'))
    await mountView({ matchId: 'm1' })
    expect(toastAddMock).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'createMatchView.errorSummary',
      detail: 'createMatchView.loadMatchError',
      life: 3000,
    })
  })

  it('sans matchId: getMatch jamais appelé, activeStep reste "when"', async () => {
    const wrapper = await mountView()
    expect(getMatchMock).not.toHaveBeenCalled()
    expect(getProbe(wrapper).vm.activeStep).toBe('when')
  })

  it('discipline présente: charge les types liés + les instructions de score', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ disciplineId: 'd1' }))
    const wrapper = await mountView()
    expect(outcomeTypeApi.list).toHaveBeenCalledWith('d1')
    expect(disciplineApi.getById).toHaveBeenCalledWith('d1')
    expect(getProbe(wrapper).vm.scoreInstructions).toBe('Enter final score')
  })

  it('sans discipline: charge tous les types, pas d’appel discipline', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ disciplineId: undefined }))
    const wrapper = await mountView()
    expect(outcomeTypeApi.list).toHaveBeenCalledWith()
    expect(disciplineApi.getById).not.toHaveBeenCalled()
    expect(getProbe(wrapper).vm.scoreInstructions).toBeNull()
  })

  it('création: sélectionne le type par défaut et charge ses raisons', async () => {
    const wrapper = await mountView()
    expect(getProbe(wrapper).vm.formState.outcomeTypeId).toBe('ot-default')
    expect(outcomeReasonApi.list).toHaveBeenCalledWith('ot-default')
  })

  it('édition avec outcomeTypeId déjà défini: ignore le type par défaut', async () => {
    getMatchMock.mockResolvedValue(makeMatchDetail({ outcomeTypeId: 'ot-1' }))
    await mountView({ matchId: 'm1' })
    expect(outcomeReasonApi.list).toHaveBeenCalledWith('ot-1')
  })

  it('aucun type par défaut et pas de matchId: outcomeTypeId reste null, pas d’appel raisons', async () => {
    vi.mocked(outcomeTypeApi.list).mockResolvedValue([makeOutcomeType({ isDefault: false })])
    const wrapper = await mountView()
    expect(getProbe(wrapper).vm.formState.outcomeTypeId).toBeNull()
    expect(outcomeReasonApi.list).not.toHaveBeenCalled()
  })

  it('playedAt futur: réinitialise vainqueur/score/outcome', async () => {
    const wrapper = await mountView()
    const probe = getProbe(wrapper)
    const future = new Date(Date.now() + 86_400_000)
    probe.vm.formState.playedAt = future
    await flushPromises()
    expect(probe.vm.formState.winnerPosition).toBeNull()
    expect(probe.vm.formState.scorePerSide).toEqual({ 1: 0, 2: 0 })
    expect(probe.vm.formState.outcomeTypeId).toBeNull()
    expect(probe.vm.formState.outcomeReasonId).toBeNull()
  })

  it('playedAt passé: ne réinitialise rien', async () => {
    const wrapper = await mountView()
    const probe = getProbe(wrapper)
    probe.vm.formState.outcomeTypeId = 'ot-default'
    const past = new Date('2020-01-01')
    probe.vm.formState.playedAt = past
    await flushPromises()
    expect(probe.vm.formState.outcomeTypeId).toBe('ot-default')
  })

  it('playedAt à null: pas de réinitialisation ni erreur', async () => {
    const wrapper = await mountView()
    const probe = getProbe(wrapper)
    probe.vm.formState.outcomeTypeId = 'ot-default'
    probe.vm.formState.playedAt = null
    await flushPromises()
    expect(probe.vm.formState.outcomeTypeId).toBe('ot-default')
  })

  it('isMobile=true: rend le stepper mobile', async () => {
    vi.mocked(useViewport).mockReturnValue({ width: ref(400), isMobile: ref(true) })
    const wrapper = await mountView()
    expect(wrapper.findComponent(MobileProbe).exists()).toBe(true)
    expect(wrapper.findComponent(DesktopProbe).exists()).toBe(false)
  })

  it('isMobile=false: rend le stepper desktop', async () => {
    const wrapper = await mountView()
    expect(wrapper.findComponent(DesktopProbe).exists()).toBe(true)
    expect(wrapper.findComponent(MobileProbe).exists()).toBe(false)
  })

  it('mode bracket: bracketLocked=true transmis au stepper', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ mode: 'bracket' }))
    const wrapper = await mountView()
    expect(getProbe(wrapper).props('bracketLocked')).toBe(true)
  })

  it('mode championship: bracketLocked=false transmis au stepper', async () => {
    loadTournamentMock.mockResolvedValue(makeClientTournament({ mode: 'championship' }))
    const wrapper = await mountView()
    expect(getProbe(wrapper).props('bracketLocked')).toBe(false)
  })

  it('fournit le contexte MATCH_FORM_KEY attendu aux descendants', async () => {
    const wrapper = await mountView()
    const probe = getProbe(wrapper)
    expect(probe.vm.participants).toEqual([
      { id: 'u1', displayName: 'Alice' },
      { id: 'u2', displayName: 'Bob' },
    ])
    expect(probe.vm.isLoading).toBe(false)
    expect(probe.vm.activeStep).toBe('when')
    expect(probe.vm.tournament?.teamMode).toBe('flex')
  })
})
