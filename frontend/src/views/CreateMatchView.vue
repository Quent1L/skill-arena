<template>
  <MatchFormStepperMobile v-if="isMobile" :tournament-id="tournamentId" :match-id="matchId" :bracket-locked="isBracketMatch" />
  <MatchFormStepperDesktop v-else :tournament-id="tournamentId" :match-id="matchId" :bracket-locked="isBracketMatch" />
</template>

<script setup lang="ts">
import { ref, computed, provide, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useViewport } from '@/composables/useViewport'
import MatchFormStepperMobile from '@/components/match/mobile/MatchFormStepperMobile.vue'
import MatchFormStepperDesktop from '@/components/match/MatchFormStepperDesktop.vue'
import { MATCH_FORM_KEY } from '@/composables/match/match-form.context'
import type { MatchFormState } from '@/composables/match/match-form.context'
import { useMatchService } from '@/composables/match/match.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useTeamService } from '@/composables/team/team.service'
import { useParticipantService } from '@/composables/participant.service'
import { useAuth } from '@/composables/useAuth'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { disciplineApi } from '@/composables/discipline/discipline.api'
import type { ClientBaseTournament, MatchSideInput, OutcomeType, OutcomeReason } from '@skill-arena/shared'
import type { TournamentPlayer } from '@/composables/match/match-form.context'

const route = useRoute()
const { isMobile } = useViewport()
const toast = useToast()

const tournamentId = route.params.tournamentId as string
const matchId = route.query.matchId as string | undefined

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
      summary: 'Erreur',
      detail: 'Impossible de charger le match',
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
  await loadOutcomeData()
  isLoading.value = false
})

provide(MATCH_FORM_KEY, { formState, activeStep, tournament, playersMap, teams, participants, outcomeTypes, outcomeReasons, scoreInstructions, isLoading })
</script>
