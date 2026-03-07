<template>
  <div class="pt-6">
    <TeamPreview :team-a-players="teamAPlayers" :team-b-players="teamBPlayers" />

    <div class="flex flex-col gap-6 mt-6">
      <!-- 1. Vainqueur -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Vainqueur <span class="text-red-500">*</span></label>
        <SelectButton
          v-model="winnerModel"
          :options="filteredWinnerOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <!-- 2. Type de résultat -->
      <div class="flex flex-col gap-2">
        <label for="outcome-type" class="text-sm font-medium">Type de résultat</label>
        <Select
          id="outcome-type"
          v-model="outcomeTypeIdModel"
          :options="outcomeTypes"
          option-label="name"
          option-value="id"
          placeholder="Sélectionner un type"
          class="w-full"
          :loading="loadingOutcomeTypes"
          @change="onOutcomeTypeChange"
        />
      </div>

      <!-- 3. Raison du résultat (only if outcome type is selected, not "Normal", and has reasons) -->
      <div
        v-if="outcomeTypeIdModel && showOutcomeReasonSelection && filteredOutcomeReasons.length > 0"
        class="flex flex-col gap-2"
      >
        <label for="outcome-reason" class="text-sm font-medium">Raison du résultat</label>
        <Select
          id="outcome-reason"
          v-model="outcomeReasonIdModel"
          :options="filteredOutcomeReasons"
          option-label="name"
          option-value="id"
          placeholder="Sélectionner une raison"
          class="w-full"
          :loading="loadingOutcomeReasons"
        />
      </div>

      <!-- 4. Saisie du score A et B -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Score <span class="text-red-500">*</span></label>
        <Message v-if="scoreInstructions" severity="info" :closable="false">{{ scoreInstructions }}</Message>
        <div class="flex items-center justify-center gap-8">
          <div class="text-center">
            <div class="text-xs text-gray-500 mb-2">Score A</div>
            <InputNumber
              v-model="scoreAModel"
              :min="props.minScore ?? 0"
              :max="props.maxScore ?? undefined"
              class="text-2xl font-bold"
              input-class="w-20 text-center"
            />
          </div>
          <div class="text-lg text-gray-600">vs</div>
          <div class="text-center">
            <div class="text-xs text-gray-500 mb-2">Score B</div>
            <InputNumber
              v-model="scoreBModel"
              :min="props.minScore ?? 0"
              :max="props.maxScore ?? undefined"
              class="text-2xl font-bold"
              input-class="w-20 text-center"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="validationMessages.length > 0" class="mt-4 flex flex-col gap-2">
      <Message v-for="msg in validationMessages" :key="msg" severity="warn" :closable="false">
        {{ msg }}
      </Message>
    </div>

    <div class="flex pt-6 justify-between">
      <Button v-if="!hidePreviousButton" label="Précédent" severity="secondary" icon="fas fa-arrow-left" @click="onPrevious" />
      <div v-else />
      <Button
        :label="submitLabel || 'Créer le match'"
        icon="fas fa-check"
        @click="onCreate"
        :loading="loading"
        :disabled="disabled || !canCreate"
        class="bg-green-600 hover:bg-green-700"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputNumber from 'primevue/inputnumber'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { tournamentApi } from '@/composables/tournament/tournament.api'
import { disciplineApi } from '@/composables/discipline/discipline.api'
import { type OutcomeReason, type OutcomeType } from '@skill-arena/shared/types/index'
import TeamPreview from './TeamPreview.vue'

interface Props {
  teamAPlayers: string[]
  teamBPlayers: string[]
  tournamentId: string
  allowDraw?: boolean
  loading?: boolean
  disabled?: boolean
  hidePreviousButton?: boolean
  submitLabel?: string
  minScore?: number | null
  maxScore?: number | null
}

interface Emits {
  (e: 'previous'): void
  (e: 'create'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const outcomeTypes = ref<OutcomeType[]>([])
const outcomeReasons = ref<OutcomeReason[]>([])
const loadingOutcomeTypes = ref(false)
const loadingOutcomeReasons = ref(false)
const scoreInstructions = ref<string | null>(null)

const baseWinnerOptions = [
  { label: 'Équipe A', value: 'teamA' },
  { label: 'Match nul', value: null },
  { label: 'Équipe B', value: 'teamB' },
]

const winnerModel = defineModel<'teamA' | 'teamB' | null>('winner', { default: null })
const outcomeTypeIdModel = defineModel<string | null>('outcomeTypeId', { default: null })
const outcomeReasonIdModel = defineModel<string | null>('outcomeReasonId', { default: null })
const scoreAModel = defineModel<number>('scoreA', { required: true })
const scoreBModel = defineModel<number>('scoreB', { required: true })

const filteredOutcomeReasons = computed(() => {
  if (!outcomeTypeIdModel.value) return []
  return outcomeReasons.value.filter((reason) => reason.outcomeTypeId === outcomeTypeIdModel.value)
})

const selectedOutcomeType = computed(() => {
  if (!outcomeTypeIdModel.value) return null
  return outcomeTypes.value.find((type) => type.id === outcomeTypeIdModel.value)
})

const isNormalOutcomeType = computed(() => {
  return selectedOutcomeType.value?.isDefault === true
})

const showOutcomeReasonSelection = computed(() => {
  return !isNormalOutcomeType.value
})

const filteredWinnerOptions = computed(() => {
  if (props.allowDraw) {
    return baseWinnerOptions
  }
  return baseWinnerOptions.filter((option) => option.value !== null)
})

const canCreate = computed(() => {
  if (winnerModel.value === null) return false
  const inRange = (v: number) =>
    (props.minScore == null || v >= props.minScore) &&
    (props.maxScore == null || v <= props.maxScore)
  return inRange(scoreAModel.value) && inRange(scoreBModel.value)
})

const validationMessages = computed<string[]>(() => {
  const messages: string[] = []
  if (winnerModel.value === null) {
    messages.push(
      props.allowDraw
        ? 'Sélectionnez un vainqueur ou choisissez match nul.'
        : 'Sélectionnez un vainqueur.'
    )
  }
  if (props.minScore != null && (scoreAModel.value < props.minScore || scoreBModel.value < props.minScore)) {
    messages.push(`Le score minimum autorisé est ${props.minScore}.`)
  }
  if (props.maxScore != null && (scoreAModel.value > props.maxScore || scoreBModel.value > props.maxScore)) {
    messages.push(`Le score maximum autorisé est ${props.maxScore}.`)
  }
  return messages
})

async function loadOutcomeTypes() {
  if (!props.tournamentId) return

  loadingOutcomeTypes.value = true
  try {
    const tournament = await tournamentApi.getById(props.tournamentId)
    const disciplineId = tournament.disciplineId || undefined

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

    // Auto-select default type if no type is already selected
    if (!outcomeTypeIdModel.value && outcomeTypes.value.length > 0) {
      const defaultType = outcomeTypes.value.find((type) => type.isDefault)
      if (defaultType) {
        outcomeTypeIdModel.value = defaultType.id
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des types de résultat:', error)
  } finally {
    loadingOutcomeTypes.value = false
  }
}

async function loadOutcomeReasons(outcomeTypeId: string) {
  loadingOutcomeReasons.value = true
  try {
    const reasons = await outcomeReasonApi.list(outcomeTypeId)
    outcomeReasons.value = [
      ...outcomeReasons.value.filter((r) => r.outcomeTypeId !== outcomeTypeId),
      ...reasons,
    ]
  } catch (error) {
    console.error('Erreur lors du chargement des raisons de résultat:', error)
  } finally {
    loadingOutcomeReasons.value = false
  }
}

function onOutcomeTypeChange() {
  outcomeReasonIdModel.value = null
  if (outcomeTypeIdModel.value) {
    loadOutcomeReasons(outcomeTypeIdModel.value)
  }
}

watch(outcomeTypeIdModel, (newValue) => {
  if (newValue) {
    loadOutcomeReasons(newValue)
  } else {
    outcomeReasons.value = outcomeReasons.value.filter((r) => r.outcomeTypeId !== newValue)
  }
})

function onPrevious() {
  emit('previous')
}

function onCreate() {
  emit('create')
}

onMounted(() => {
  loadOutcomeTypes()
  if (outcomeTypeIdModel.value) {
    loadOutcomeReasons(outcomeTypeIdModel.value)
  }
})
</script>
