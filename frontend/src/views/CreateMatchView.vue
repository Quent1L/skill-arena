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
                  :loading="creating"
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
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useMatchService } from '@/composables/match.service'
import { useTournamentService } from '@/composables/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import type { MatchStatus, BaseTournament, ParticipantListItem } from '@skill-arena/shared'
import TeamSelectionStep from '@/components/match/TeamSelectionStep.vue'
import MatchStatusStep from '@/components/match/MatchStatusStep.vue'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const router = useRouter()
const route = useRoute()
const toast = useToast()

const { createMatch: createMatchService, validateMatch } = useMatchService()
const { getTournament } = useTournamentService()
const { getTournamentParticipants } = useParticipantService()

const tournamentId = route.params.tournamentId as string

const activeStep = ref('1')
const creating = ref(false)
const matchCreated = ref(false)
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
const playersMap = ref<Record<string, string>>({})
const validationResult = ref<ValidationResult | null>(null)

async function loadParticipants() {
  if (!tournamentId) return
  try {
    const participants = (await getTournamentParticipants(tournamentId)) as ParticipantListItem[]
    const map: Record<string, string> = {}
    for (const p of participants) {
      map[p.userId] = p.user.displayName
    }
    playersMap.value = map
  } catch (err) {
    console.error('Erreur loading participants map:', err)
  }
}

const canProceedToNext = computed((): boolean => {
  const result = validationResult.value
  if (!result) return false

  switch (activeStep.value) {
    case '1':
      return (
        result.valid &&
        matchData.value.playerIdsA.length > 0 &&
        matchData.value.playerIdsB.length > 0
      )
    case '2':
      return result.valid
    default:
      return false
  }
})

const canCreateMatch = computed((): boolean => {
  const result = validationResult.value
  return Boolean(
    (result?.valid ?? false) &&
      matchData.value.status &&
      (matchData.value.status !== 'scheduled' || scheduledDate.value) &&
      (matchData.value.status !== 'reported' ||
        (matchData.value.scoreA >= 0 && matchData.value.scoreB >= 0)),
  )
})

const teamSelectorValidation = computed((): ValidationResult | undefined =>
  validationResult.value ? validationResult.value : undefined,
)

const teamAPlayers = computed(() =>
  matchData.value.playerIdsA.map((id) => playersMap.value[id] ?? `Joueur ${id}`),
)

const teamBPlayers = computed(() =>
  matchData.value.playerIdsB.map((id) => playersMap.value[id] ?? `Joueur ${id}`),
)

async function loadTournament() {
  try {
    const result = await getTournament(tournamentId)
    tournament.value = result
  } catch (error) {
    console.error('Erreur lors du chargement du tournoi:', error)
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: 'Impossible de charger les informations du tournoi',
      life: 3000,
    })
  }
}

async function validateCurrentStep(step?: string) {
  try {
    const currentStep = step ?? activeStep.value

    const dataToValidate: {
      tournamentId: string
      playerIdsA?: string[]
      playerIdsB?: string[]
    } = {
      tournamentId,
    }
    switch (currentStep) {
      case '1':
      case '2':
        dataToValidate.playerIdsA = matchData.value.playerIdsA
        dataToValidate.playerIdsB = matchData.value.playerIdsB
        break
    }

    const result = await validateMatch(dataToValidate)
    validationResult.value = result
  } catch (error) {
    console.error('Erreur de validation:', error)
    validationResult.value = {
      valid: false,
      errors: ['Erreur lors de la validation'],
      warnings: [],
    }
  }
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

  creating.value = true

  try {
    const matchPayload = {
      ...matchData.value,
      ...(matchData.value.status === 'scheduled' &&
        scheduledDate.value && {
          scheduledAt: scheduledDate.value.toISOString(),
        }),
    }

    await createMatchService(matchPayload)

    matchCreated.value = true

    toast.add({
      severity: 'success',
      summary: 'Succès',
      detail: 'Match créé avec succès',
      life: 3000,
    })

    router.push(`/tournaments/${tournamentId}?tab=1`)
  } catch (error) {
    console.error('Erreur lors de la création du match:', error)
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: error instanceof Error ? error.message : 'Erreur lors de la création du match',
      life: 5000,
    })
  } finally {
    creating.value = false
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

onMounted(() => {
  loadTournament()
  loadParticipants()
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
