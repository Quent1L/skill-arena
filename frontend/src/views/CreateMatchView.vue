<template>
  <MatchFormStepperMobile
    v-if="isMobile"
    :tournament-id="tournamentId"
    :match-id="matchId"
    :bracket-locked="isBracketMatch"
  />
  <MatchFormStepperDesktop
    v-else
    :tournament-id="tournamentId"
    :match-id="matchId"
    :bracket-locked="isBracketMatch"
  />
</template>

<script setup lang="ts">
import { ref, computed, provide, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppToast } from '@/composables/useAppToast'
import { useViewport } from '@/composables/useViewport'
import MatchFormStepperMobile from '@/components/match/mobile/MatchFormStepperMobile.vue'
import MatchFormStepperDesktop from '@/components/match/MatchFormStepperDesktop.vue'
import {
  MATCH_FORM_KEY,
  type MatchFormState,
  type TournamentPlayer,
} from '@/composables/match/match-form.context'
import { useMatchService } from '@/composables/match/match.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useTeamService } from '@/composables/team/team.service'
import { useParticipantService } from '@/composables/participant.service'
import { useAuth } from '@/composables/useAuth'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { disciplineApi } from '@/composables/discipline/discipline.api'
import { rankedApi } from '@/composables/ranked/ranked.api'
import type { PlayerStandings } from '@/composables/match/match-balance'
import type {
  ClientBaseTournament,
  MatchSideInput,
  OutcomeType,
  OutcomeReason,
} from '@skol-arena/shared'

const { t } = useI18n()
const route = useRoute()
const { isMobile } = useViewport()
const toast = useAppToast()

const tournamentId = route.params.tournamentId as string
const matchId = route.query.matchId as string | undefined
const sourceMatchId = route.query.sourceMatchId as string | undefined

const { playersMap, loadPlayersMap, getMatch } = useMatchService()
const { loadTournamentWithErrorHandling } = useTournamentService()
const { teams, loadTeams } = useTeamService()
const { getTournamentParticipants } = useParticipantService()
const { isAdmin, appUser } = useAuth()

const tournament = ref<ClientBaseTournament | null>(null)
const isBracketMatch = computed(() => tournament.value?.mode === 'bracket')
const participants = ref<TournamentPlayer[]>([])
const outcomeTypes = ref<OutcomeType[]>([])
const outcomeReasons = ref<OutcomeReason[]>([])
const scoreInstructions = ref<string | null>(null)
const isLoading = ref(false)

const formState = ref<MatchFormState>({
  playedAt: null,
  sides: [{ position: 1 }, { position: 2 }],
  allPlayerIds: [],
  winnerPosition: null,
  scorePerSide: { 1: 0, 2: 0 },
  outcomeTypeId: null,
  outcomeReasonId: null,
})
const activeStep = ref('when')

// --- Balance preview -------------------------------------------------------
// A ranked match can be entered days late, so the line-up must be priced with
// the MMR the players held on the day they played. The snapshot is therefore
// fetched only once both inputs are settled: the date (step `when`) and the
// player list (step `participants` / `teams`). Entering `composition` or
// `result` is exactly that moment, and it also covers the two paths that skip
// the composition step — a 1v1, and a bracket-locked match going straight from
// `when` to `result`.
const standings = ref<PlayerStandings | null>(null)
// `${date}|${sorted ids}` of the loaded snapshot: navigating back and forth
// between steps must not refetch, but changing the date or the roster must.
const standingsKey = ref('')

async function loadStandings() {
  if (tournament.value?.mode !== 'ranked') return
  const playedAt = formState.value.playedAt
  const playerIds = formState.value.allPlayerIds
  if (!playedAt || playerIds.length < 2) return

  const key = `${playedAt.toISOString()}|${[...playerIds].sort().join(',')}`
  if (key === standingsKey.value) return

  try {
    const entries = await rankedApi.getMmrSnapshot(tournamentId, playerIds, playedAt)
    standings.value = Object.fromEntries(
      entries.map((e) => [e.playerId, { mmr: e.mmr, isPlacement: e.isPlacement }]),
    )
    standingsKey.value = key
  } catch {
    // The bar is a hint, not a prerequisite: a failed snapshot hides it and
    // leaves the wizard alone rather than raising an error over a preview.
    standings.value = null
    standingsKey.value = ''
  }
}

watch(activeStep, (step) => {
  if (step === 'composition' || step === 'result') void loadStandings()
})

watch(
  () => formState.value.playedAt,
  (date) => {
    if (!date) return
    if (date > new Date()) {
      formState.value.winnerPosition = null
      formState.value.scorePerSide = { 1: 0, 2: 0 }
      formState.value.outcomeTypeId = null
      formState.value.outcomeReasonId = null
    }
  },
)

async function loadExistingMatch() {
  if (!matchId) return
  try {
    const match = await getMatch(matchId)
    if (match.playedAt) formState.value.playedAt = match.playedAt

    const sides: MatchSideInput[] = match.sides.map((s) => ({
      position: s.position,
      playerIds: s.players.map((p) => p.id),
    }))
    formState.value.sides = sides
    formState.value.allPlayerIds = sides.flatMap((s) => s.playerIds ?? [])

    formState.value.scorePerSide = {}
    for (const s of match.sides) {
      formState.value.scorePerSide[s.position] = s.score ?? 0
    }

    if (match.outcomeTypeId) formState.value.outcomeTypeId = match.outcomeTypeId
    formState.value.outcomeReasonId = match.outcomeReasonId || null

    const winner = match.sides.find((s) => s.isWinner)
    formState.value.winnerPosition = winner ? winner.position : null

    if (match.status === 'reported' || match.status === 'pending_confirmation') {
      activeStep.value = 'result'
    }
  } catch {
    toast.add({
      severity: 'error',
      summary: t('createMatchView.errorSummary'),
      detail: t('createMatchView.loadMatchError'),
      life: 3000,
    })
  }
}

async function loadMatchForRematch() {
  if (!sourceMatchId) return
  try {
    const match = await getMatch(sourceMatchId)
    const sides: MatchSideInput[] = match.sides.map((s) => ({
      position: s.position,
      playerIds: s.players.map((p) => p.id),
      teamId: s.teamId ?? undefined,
    }))
    formState.value.sides = sides
    formState.value.allPlayerIds = sides.flatMap((s) => s.playerIds ?? [])
  } catch {
    toast.add({
      severity: 'error',
      summary: t('createMatchView.errorSummary'),
      detail: t('createMatchView.loadMatchError'),
      life: 3000,
    })
  }
}

async function loadParticipants() {
  const raw = await getTournamentParticipants(tournamentId)
  participants.value = raw.map((p) => ({ id: p.userId, displayName: p.user.displayName }))
  if (!isAdmin.value && appUser.value) {
    const userId = appUser.value.id
    if (
      !formState.value.allPlayerIds.includes(userId) &&
      participants.value.some((p) => p.id === userId)
    ) {
      formState.value.allPlayerIds = [userId, ...formState.value.allPlayerIds]
    }
  }
}

async function loadOutcomeData() {
  const disciplineId = tournament.value?.disciplineId || undefined
  if (disciplineId) {
    const [types, discipline] = await Promise.all([
      outcomeTypeApi.list(disciplineId),
      disciplineApi.getById(disciplineId),
    ])
    outcomeTypes.value = types
    scoreInstructions.value = discipline.scoreInstructions ?? null
  } else {
    outcomeTypes.value = await outcomeTypeApi.list()
  }
  if (!formState.value.outcomeTypeId) {
    const def = outcomeTypes.value.find((t) => t.isDefault)
    if (def) formState.value.outcomeTypeId = def.id
  }
  if (formState.value.outcomeTypeId) {
    outcomeReasons.value = await outcomeReasonApi.list(formState.value.outcomeTypeId)
  }
}

onMounted(async () => {
  isLoading.value = true
  tournament.value = await loadTournamentWithErrorHandling(tournamentId)
  await loadPlayersMap(tournamentId)
  if (tournament.value?.teamMode === 'static') await loadTeams(tournamentId)
  else await loadParticipants()
  if (matchId) await loadExistingMatch()
  else if (sourceMatchId) await loadMatchForRematch()
  await loadOutcomeData()
  isLoading.value = false
})

provide(MATCH_FORM_KEY, {
  formState,
  activeStep,
  tournament,
  playersMap,
  teams,
  participants,
  outcomeTypes,
  outcomeReasons,
  scoreInstructions,
  isLoading,
  standings,
})
</script>
