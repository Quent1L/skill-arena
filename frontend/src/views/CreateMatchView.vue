<template>
  <div class="create-match-view">
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-2xl font-semibold p-4">Créer un match</h1>
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
                  :validation="teamSelectorValidation"
                  :disabled="!canProceedToNext"
                  @validate="() => validateCurrentStep('1')"
                  @next="() => goToStep(activateCallback, '2')"
                />
              </StepPanel>
            </StepItem>
            <StepItem value="2">
              <Step>Statut et score</Step>

              <StepPanel v-slot="{ activateCallback }" value="2">
                <MatchStatusStep
                  :team-a-players="teamAPlayers"
                  :team-b-players="teamBPlayers"
                  v-model:mode-selection="modeSelection"
                  v-model:score-a="matchData.scoreA"
                  v-model:score-b="matchData.scoreB"
                  v-model:scheduled-date="scheduledDate"
                  :loading="matchLoading"
                  :disabled="!canCreateMatch"
                  @previous="activateCallback('1')"
                  @create="createMatch"
                /> </StepPanel
            ></StepItem>
          </Stepper>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useMatchService } from '@/composables/match.service'
import { useTournamentService } from '@/composables/tournament.service'
import type { MatchStatus, BaseTournament } from '@skill-arena/shared'
import TeamSelectionStep from '@/components/match/TeamSelectionStep.vue'
import MatchStatusStep from '@/components/match/MatchStatusStep.vue'

const route = useRoute()

const {
  validationResult,
  loading: matchLoading,
  loadPlayersMap,
  validateMatchForStep,
  canProceedToNextStep,
  canCreateMatch: canCreateMatchCheck,
  createMatchWithNavigation,
  getTeamPlayersNames,
  playersMap,
} = useMatchService()
const { loadTournamentWithErrorHandling } = useTournamentService()

const tournamentId = route.params.tournamentId as string

const activeStep = ref('1')
const scheduledDate = ref<Date | null>(null)

const matchData = ref({
  tournamentId,
  playerIdsA: [] as string[],
  playerIdsB: [] as string[],
  status: 'reported' as MatchStatus,
  scoreA: 0,
  scoreB: 0,
  reportProof: '',
})

const modeSelection = ref<'reported' | 'scheduled'>('reported')
const tournament = ref<BaseTournament | null>(null)

const canProceedToNext = computed(() =>
  canProceedToNextStep(
    activeStep.value,
    matchData.value.playerIdsA,
    matchData.value.playerIdsB,
  ),
)

const canCreateMatch = computed(() =>
  canCreateMatchCheck(
    matchData.value.status,
    scheduledDate.value,
    matchData.value.scoreA,
    matchData.value.scoreB,
  ),
)

const teamSelectorValidation = computed(() => validationResult.value ?? undefined)

const teamAPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsA))

const teamBPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsB))

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
  )
}

watch(modeSelection, (v) => {
  matchData.value.status = v as MatchStatus
  if (v === 'scheduled') {
    matchData.value.scoreA = 0
    matchData.value.scoreB = 0
    matchData.value.reportProof = ''
  } else {
    scheduledDate.value = null
  }
})

async function createMatch() {
  if (!canCreateMatch.value) return
  await createMatchWithNavigation(matchData.value, scheduledDate.value, tournamentId)
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

onMounted(async () => {
  await loadTournament()
  await loadPlayersMap(tournamentId)
})

watch(modeSelection, (v) => {
  matchData.value.status = v as MatchStatus
})

watch(activeStep, async (newStep, oldStep) => {
  if (newStep !== oldStep) {
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
