<template>
  <div v-if="isMobile">
    <MatchFormStepper
      :tournament-id="tournamentId"
      :min-date="tournamentMinDate"
      :max-date="tournamentMaxDate"
      :allow-draw="tournament?.allowDraw ?? false"
      :initial-data="matchData"
      :match-id="matchId"
    />
  </div>
  <div v-else class="create-match-view">
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-2xl font-semibold p-4">
        {{ isEditMode ? 'Compléter le match' : 'Créer un match' }}
      </h1>
      <Card class="mb-6">
        <template #content>
          <Stepper :value="activeStep" class="w-full" linear>
            <StepItem value="1">
              <Step>Saisie des équipes</Step>
              <StepPanel v-slot="{ activateCallback }" value="1">
                <TeamSelectionStep
                  :tournament-id="tournamentId"
                  v-model:player-ids-a="matchData.playerIdsA"
                  v-model:player-ids-b="matchData.playerIdsB"
                  v-model:scheduled-date="matchData.playedAt"
                  :min-date="tournamentMinDate"
                  :max-date="tournamentMaxDate"
                  :validation="teamSelectorValidation"
                  :disabled="!canProceedToNext"
                  @validate="() => validateCurrentStep('1')"
                  @next="() => goToStep(activateCallback, '2')"
                  @create="createMatch"
                />
              </StepPanel>
            </StepItem>
            <StepItem v-if="canAccessResultStep" value="2">
              <Step>Vainqueur</Step>

              <StepPanel v-slot="{ activateCallback }" value="2">
                <MatchResultStep
                  :team-a-players="teamAPlayers"
                  :team-b-players="teamBPlayers"
                  :tournament-id="tournamentId"
                  v-model:score-a="scoreA"
                  v-model:score-b="scoreB"
                  v-model:outcome-type-id="matchData.outcomeTypeId"
                  v-model:outcome-reason-id="matchData.outcomeReasonId"
                  v-model:winner="matchData.winner"
                  :allow-draw="tournament?.allowDraw ?? false"
                  :loading="matchLoading"
                  :disabled="!canCreateMatch"
                  @previous="activateCallback('1')"
                  @create="createMatch"
                />
              </StepPanel>
            </StepItem>
          </Stepper>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useMatchService } from '@/composables/match.service'
import { useTournamentService } from '@/composables/tournament.service'
import type {
  MatchStatus,
  ClientBaseTournament,
  ClientCreateMatchRequest,
  ClientUpdateMatchRequest,
} from '@skill-arena/shared/types/index'
import TeamSelectionStep from '@/components/match/TeamSelectionStep.vue'
import MatchResultStep from '@/components/match/MatchResultStep.vue'
import MatchFormStepper from '@/components/match/mobile/MatchFormStepper.vue'

const route = useRoute()
const toast = useToast()

const {
  validationResult,
  loading: matchLoading,
  loadPlayersMap,
  validateMatchForStep,
  canProceedToNextStep,
  canCreateMatch: canCreateMatchCheck,
  createMatchWithNavigation,
  updateMatchWithNavigation,
  getMatch,
  getTeamPlayersNames,
} = useMatchService()
const { loadTournamentWithErrorHandling } = useTournamentService()

const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const tournamentId = route.params.tournamentId as string
const matchId = route.query.matchId as string | undefined
const isEditMode = computed(() => !!matchId)

const activeStep = ref('1')
const scheduledDate = ref<Date | null>(new Date()) // Default to current date/time

// Local type for form data that includes all fields needed for both create and update
// Uses client types where dates are Date objects (not strings)
type MatchFormData = Omit<ClientCreateMatchRequest, 'playedAt'> &
  Partial<Omit<ClientUpdateMatchRequest, 'playedAt'>> & {
    scoreA?: number
    scoreB?: number
    reportProof?: string
    outcomeTypeId?: string | null
    outcomeReasonId?: string | null
    winner?: 'teamA' | 'teamB' | null
    playerIdsA: string[]
    playerIdsB: string[]
    playedAt?: Date
  }

const matchData = ref<MatchFormData>({
  tournamentId,
  playerIdsA: [] as string[],
  playerIdsB: [] as string[],
  status: 'reported' as MatchStatus,
  scoreA: 0,
  scoreB: 0,
  reportProof: '',
  outcomeTypeId: undefined,
  outcomeReasonId: undefined,
  winner: null as 'teamA' | 'teamB' | null,
  playedAt: new Date(),
})
const now = new Date()

const tournament = ref<ClientBaseTournament | null>(null)

const canProceedToNext = computed(() =>
  canProceedToNextStep(activeStep.value, matchData.value.playerIdsA, matchData.value.playerIdsB),
)

const canCreateMatch = computed(() => {
  // For scheduled matches (future date), just check if date is set
  if (scheduledDate.value && scheduledDate.value > now) {
    return !!scheduledDate.value
  }
  // For reported matches (past/present date), check all required fields
  return canCreateMatchCheck(
    matchData.value.status ?? 'reported',
    scheduledDate.value,
    matchData.value.scoreA ?? 0,
    matchData.value.scoreB ?? 0,
  )
})

const teamSelectorValidation = computed(() => validationResult.value ?? undefined)

const teamAPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsA))

const teamBPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsB))

// Computed properties for scoreA and scoreB to handle undefined -> number conversion
const scoreA = computed({
  get: () => matchData.value.scoreA ?? 0,
  set: (value: number) => {
    matchData.value.scoreA = value
  },
})

const scoreB = computed({
  get: () => matchData.value.scoreB ?? 0,
  set: (value: number) => {
    matchData.value.scoreB = value
  },
})

// Step 2 (Vainqueur) is only accessible if scheduled date is in the past or present
const canAccessResultStep = computed(() => {
  if (!scheduledDate.value) return false
  return scheduledDate.value <= now
})

const tournamentMinDate = computed(() => {
  if (!tournament.value?.startDate) return undefined
  return tournament.value.startDate
})

const tournamentMaxDate = computed(() => {
  if (!tournament.value?.endDate) return undefined
  return tournament.value.endDate
})

async function loadTournament() {
  tournament.value = await loadTournamentWithErrorHandling(tournamentId)
}

async function validateCurrentStep(step?: string) {
  const currentStep = step ?? activeStep.value
  await validateMatchForStep(
    tournamentId,
    currentStep,
    matchData.value.playerIdsA,
    matchData.value.playerIdsB,
    matchId, // Pass matchId in edit mode to exclude it from validation
  )
}

watch(
  scheduledDate,
  (newDate) => {
    if (!newDate) return

    if (newDate > new Date()) {
      // Future date = scheduled match
      matchData.value.status = 'scheduled'
      matchData.value.scoreA = 0
      matchData.value.scoreB = 0
      matchData.value.reportProof = ''
      matchData.value.outcomeTypeId = undefined
      matchData.value.outcomeReasonId = undefined
      matchData.value.winner = null
      // If we're on step 2 and date becomes future, go back to step 1
      if (activeStep.value === '2') {
        activeStep.value = '1'
      }
    } else {
      // Past or present date = reported match
      matchData.value.status = 'reported'
    }
  },
  { immediate: true },
)

async function createMatch() {
  if (!canCreateMatch.value) return

  if (isEditMode.value && matchId) {
    const updateData: ClientUpdateMatchRequest = {
      ...matchData.value,
      playedAt: matchData.value.playedAt ?? new Date(),
    }
    await updateMatchWithNavigation(matchId, updateData, tournamentId)
  } else {
    const createData: ClientCreateMatchRequest = {
      ...matchData.value,
      playedAt: matchData.value.playedAt ?? new Date(),
    }
    await createMatchWithNavigation(createData, tournamentId)
  }
}

watch(
  () => matchData.value.playerIdsA,
  () => validateCurrentStep('1'),
  { deep: true },
)
watch(
  () => matchData.value.playerIdsB,
  () => validateCurrentStep('1'),
  { deep: true },
)

async function loadExistingMatch() {
  if (!matchId) return

  try {
    const match = await getMatch(matchId)

    // Extract playerIds from participations
    const playerIdsA: string[] = []
    const playerIdsB: string[] = []

    if (match.participations) {
      match.participations.forEach((p: { playerId: string; teamSide: 'A' | 'B' }) => {
        if (p.teamSide === 'A') {
          playerIdsA.push(p.playerId)
        } else if (p.teamSide === 'B') {
          playerIdsB.push(p.playerId)
        }
      })
    }

    // Extract playerIds from team participants (for static teams)
    if (match.teamA?.participants) {
      match.teamA.participants.forEach((p: { user?: { id?: string } }) => {
        if (p.user?.id && !playerIdsA.includes(p.user.id)) {
          playerIdsA.push(p.user.id)
        }
      })
    }
    if (match.teamB?.participants) {
      match.teamB.participants.forEach((p: { user?: { id?: string } }) => {
        if (p.user?.id && !playerIdsB.includes(p.user.id)) {
          playerIdsB.push(p.user.id)
        }
      })
    }

    // Populate match data
    matchData.value.playerIdsA = playerIdsA
    matchData.value.playerIdsB = playerIdsB
    matchData.value.scoreA = match.scoreA
    matchData.value.scoreB = match.scoreB
    matchData.value.status = match.status
    matchData.value.outcomeTypeId = match.outcomeTypeId || undefined
    matchData.value.outcomeReasonId = match.outcomeReasonId || undefined
    matchData.value.reportProof = match.reportProof || ''

    // Determine winner (use winnerSide if available, otherwise fallback to winnerId)
    if (match.winnerSide) {
      matchData.value.winner = match.winnerSide === 'A' ? 'teamA' : 'teamB'
    } else if (match.winnerId) {
      // Fallback for old matches without winnerSide
      if (match.teamAId && match.winnerId === match.teamAId) {
        matchData.value.winner = 'teamA'
      } else if (match.teamBId && match.winnerId === match.teamBId) {
        matchData.value.winner = 'teamB'
      }
    }

    // playedAt is already a Date object (converted by interceptor)
    if (match.playedAt) {
      scheduledDate.value = match.playedAt
    }

    // If match is already reported, go to step 2
    if (match.status === 'reported' && scheduledDate.value && scheduledDate.value <= new Date()) {
      activeStep.value = '2'
    }
  } catch (err) {
    console.error('Erreur lors du chargement du match:', err)
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de charger le match',
      life: 3000,
    })
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  await loadTournament()
  await loadPlayersMap(tournamentId)
  if (isEditMode.value) {
    await loadExistingMatch()
  }
})

watch(activeStep, async (newStep, oldStep) => {
  if (newStep !== oldStep) {
    // Prevent access to step 2 if date is in the future
    if (newStep === '2' && !canAccessResultStep.value) {
      activeStep.value = '1'
      toast.add({
        severity: 'warn',
        summary: 'Action requise',
        detail: 'La date sélectionnée doit être dans le passé ou présente pour saisir le résultat',
        life: 3000,
      })
      return
    }
    await validateCurrentStep()
  }
})

async function goToStep(activateCallback: (s: string) => void, targetStep: string) {
  await validateCurrentStep()

  if (validationResult.value?.valid) {
    activateCallback(targetStep)
  } else {
    toast.add({
      severity: 'error',
      summary: 'Validation',
      detail: 'Veuillez corriger les erreurs avant de continuer',
      life: 3000,
    })
  }
}
</script>

<style scoped>
.create-match-view {
  min-height: 100vh;
}
</style>
