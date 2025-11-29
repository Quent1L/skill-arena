<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
    <!-- Header -->
    <div
      class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm"
    >
      <div class="flex items-center">
        <Button icon="fas fa-arrow-left" text rounded @click="goBack" class="mr-2" />
        <h1 class="text-lg font-bold">{{ step === 1 ? 'Nouveau Match' : 'Résultat' }}</h1>
      </div>
      <div class="text-sm font-medium text-gray-500">{{ step }}/2</div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Step 1: Info & Teams -->
      <div v-if="step === 1" class="space-y-4">
        <MatchBasicInfo v-model="matchData.playedAt" :min-date="minDate" :max-date="maxDate" />

        <TeamCard
          title="Équipe A"
          v-model:selected-ids="matchData.playerIdsA"
          :all-players="allPlayers"
          @validate="validate"
        />

        <TeamCard
          title="Équipe B"
          v-model:selected-ids="matchData.playerIdsB"
          :all-players="allPlayers"
          @validate="validate"
        />

        <MatchValidationPanel :validation="validationResult" />
      </div>

      <!-- Step 2: Result -->
      <div v-else-if="step === 2">
        <MatchResultStepMobile
          :team-a-players="teamAPlayers"
          :team-b-players="teamBPlayers"
          :date="matchData.playedAt"
          :tournament-id="tournamentId"
          v-model:score-a="matchData.scoreA"
          v-model:score-b="matchData.scoreB"
          v-model:winner="matchData.winner"
          v-model:outcome-type-id="matchData.outcomeTypeId"
          v-model:outcome-reason-id="matchData.outcomeReasonId"
          :allow-draw="allowDraw"
        />
      </div>
    </div>

    <!-- Bottom Action Bar -->
    <div
      class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 shadow-lg z-20"
    >
      <div v-if="step === 1" class="space-y-2">
        <Button
          v-if="isFutureDate"
          label="Programmer le match"
          icon="fas fa-calendar-check"
          class="w-full"
          :disabled="!canProceed"
          :loading="loading"
          @click="scheduleMatch"
        />
        <Button
          v-else
          label="Suivant"
          icon="fas fa-arrow-right"
          iconPos="right"
          class="w-full"
          :disabled="!canProceed"
          @click="nextStep"
        />
      </div>
      <Button
        v-else
        label="Enregistrer le match"
        icon="fas fa-check"
        class="w-full"
        :loading="loading"
        @click="submit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchService } from '@/composables/match/match.service'
import { useParticipantService } from '@/composables/participant.service'
import MatchBasicInfo from './MatchBasicInfo.vue'
import TeamCard from './TeamCard.vue'
import MatchValidationPanel from './MatchValidationPanel.vue'
import MatchResultStepMobile from './MatchResultStepMobile.vue'

import type {
  ClientCreateMatchRequest,
  ClientUpdateMatchRequest,
  MatchStatus,
} from '@skill-arena/shared/types/index'

// Props passed from parent view
interface Props {
  tournamentId: string
  minDate?: Date
  maxDate?: Date
  allowDraw?: boolean
  initialData?: Partial<ClientCreateMatchRequest & ClientUpdateMatchRequest>
  matchId?: string
}

const props = defineProps<Props>()

const router = useRouter()
const {
  validationResult,
  validateMatchForStep,
  createMatchWithNavigation,
  updateMatchWithNavigation,
  getTeamPlayersNames,
  loadPlayersMap,
  loading,
} = useMatchService()
const { getTournamentParticipants } = useParticipantService()

const step = ref(1)
const allPlayers = ref<{ id: string; displayName: string }[]>([])

const matchData = ref<{
  tournamentId: string
  playerIdsA: string[]
  playerIdsB: string[]
  playedAt: Date
  scoreA: number
  scoreB: number
  winner: 'teamA' | 'teamB' | null
  status: MatchStatus
  outcomeTypeId?: string | null
  outcomeReasonId?: string | null
}>({
  tournamentId: props.tournamentId,
  playerIdsA: [] as string[],
  playerIdsB: [] as string[],
  playedAt: new Date(),
  scoreA: 0,
  scoreB: 0,
  winner: null,
  status: 'reported',
  outcomeTypeId: null,
  outcomeReasonId: null,
})

// Initialize with props data if available (edit mode)
if (props.initialData) {
  const initial = props.initialData
  matchData.value = {
    ...matchData.value,
    ...initial,
    playedAt: initial.playedAt ? new Date(initial.playedAt) : new Date(),
    status: initial.status ?? 'reported',
  }
}

watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      matchData.value = {
        ...matchData.value,
        ...newData,
        playedAt: newData.playedAt ? new Date(newData.playedAt) : new Date(),
        status: newData.status ?? 'reported',
      }
    }
  },
  { deep: true },
)

const teamAPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsA))
const teamBPlayers = computed(() => getTeamPlayersNames(matchData.value.playerIdsB))

const canProceed = computed(() => {
  return (
    validationResult.value?.valid &&
    matchData.value.playerIdsA.length > 0 &&
    matchData.value.playerIdsB.length > 0 &&
    matchData.value.playedAt
  )
})

const isFutureDate = computed(() => {
  return matchData.value.playedAt > new Date()
})

async function loadPlayers() {
  try {
    const participants = await getTournamentParticipants(props.tournamentId)
    allPlayers.value = participants.map((p) => ({
      id: p.userId,
      displayName: p.user.displayName,
    }))
    // Also load map for service
    await loadPlayersMap(props.tournamentId)
  } catch (e) {
    console.error(e)
  }
}

async function validate() {
  await validateMatchForStep(
    props.tournamentId,
    '1',
    matchData.value.playerIdsA,
    matchData.value.playerIdsB,
    props.matchId,
  )
}

function goBack() {
  if (step.value > 1) {
    step.value--
  } else {
    router.back()
  }
}

async function nextStep() {
  await validate()
  if (canProceed.value) {
    // Status is already set correctly by watch on playedAt
    step.value = 2
  }
}

async function scheduleMatch() {
  await validate()
  if (canProceed.value) {
    matchData.value.status = 'scheduled'
    matchData.value.scoreA = 0
    matchData.value.scoreB = 0
    matchData.value.winner = null
    matchData.value.outcomeTypeId = null
    matchData.value.outcomeReasonId = null
    await submit()
  }
}

async function submit() {
  const data = {
    ...matchData.value,
    // Ensure scores are numbers
    scoreA: Number(matchData.value.scoreA),
    scoreB: Number(matchData.value.scoreB),
    outcomeTypeId: matchData.value.outcomeTypeId || undefined,
    outcomeReasonId: matchData.value.outcomeReasonId || undefined,
  }

  if (props.matchId) {
    await updateMatchWithNavigation(props.matchId, data, props.tournamentId)
  } else {
    await createMatchWithNavigation(data, props.tournamentId)
  }
}

// Watch playedAt to automatically set status
watch(
  () => matchData.value.playedAt,
  (newDate) => {
    if (!newDate) return

    if (newDate > new Date()) {
      // Future date = scheduled match
      matchData.value.status = 'scheduled'
    } else {
      // Past or present date = reported match
      matchData.value.status = 'reported'
    }
  },
  { immediate: true }
)

onMounted(() => {
  loadPlayers()
  validate()
})
</script>
