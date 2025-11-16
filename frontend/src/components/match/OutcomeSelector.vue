<template>
  <div class="outcome-selector flex flex-col gap-4">
    <!-- Outcome Type Selection -->
    <div class="flex flex-col gap-2">
      <label for="outcome-type" class="text-xs text-gray-500">Type de résultat</label>
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

    <!-- Outcome Reason Selection (only if outcome type is selected, not "Normal", and has reasons) -->
    <div v-if="outcomeTypeIdModel && showOutcomeReasonSelection && filteredOutcomeReasons.length > 0" class="flex flex-col gap-2">
      <label for="outcome-reason" class="text-xs text-gray-500">Raison du résultat</label>
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

    <!-- Winner Selection (only if outcome type is selected, not "Normal", and scores are different) -->
    <div v-if="outcomeTypeIdModel && showWinnerSelection && showWinnerSelectionField" class="flex flex-col gap-2">
      <label class="text-xs text-gray-500">Vainqueur</label>
      <SelectButton
        v-model="winnerModel"
        :options="filteredWinnerOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { outcomeTypeApi,} from '@/composables/outcome-type.api'
import { outcomeReasonApi} from '@/composables/outcome-reason.api'
import { tournamentApi } from '@/composables/tournament.api'
import { outcomeTypeNameEnum, type OutcomeReason, type OutcomeType } from '@skill-arena/shared/types/index'

interface Props {
  outcomeTypeId?: string | null
  outcomeReasonId?: string | null
  winner?: 'teamA' | 'teamB' | null
  disciplineId?: string
  tournamentId?: string
  allowDraw?: boolean
  scoreA?: number
  scoreB?: number
}

const props = withDefaults(defineProps<Props>(), {
  outcomeTypeId: null,
  outcomeReasonId: null,
  winner: null,
  disciplineId: undefined,
  tournamentId: undefined,
  allowDraw: false,
  scoreA: undefined,
  scoreB: undefined,
})

const emit = defineEmits<{
  'update:outcomeTypeId': [value: string | null]
  'update:outcomeReasonId': [value: string | null]
  'update:winner': [value: 'teamA' | 'teamB' | null]
}>()

const outcomeTypes = ref<OutcomeType[]>([])
const outcomeReasons = ref<OutcomeReason[]>([])
const loadingOutcomeTypes = ref(false)
const loadingOutcomeReasons = ref(false)

const baseWinnerOptions = [
  { label: 'Équipe A', value: 'teamA' },
  { label: 'Équipe B', value: 'teamB' },
  { label: 'Match nul', value: null },
]

const outcomeTypeIdModel = computed({
  get: () => props.outcomeTypeId,
  set: (value) => emit('update:outcomeTypeId', value || null),
})

const outcomeReasonIdModel = computed({
  get: () => props.outcomeReasonId,
  set: (value) => emit('update:outcomeReasonId', value || null),
})

const winnerModel = computed({
  get: () => props.winner,
  set: (value) => emit('update:winner', value || null),
})

const filteredOutcomeReasons = computed(() => {
  if (!outcomeTypeIdModel.value) return []
  return outcomeReasons.value.filter(
    (reason) => reason.outcomeTypeId === outcomeTypeIdModel.value
  )
})

const selectedOutcomeType = computed(() => {
  if (!outcomeTypeIdModel.value) return null
  return outcomeTypes.value.find((type) => type.id === outcomeTypeIdModel.value)
})

const isNormalOutcomeType = computed(() => {
  return selectedOutcomeType.value?.name === outcomeTypeNameEnum.NORMAL
})

const showOutcomeReasonSelection = computed(() => {
  return !isNormalOutcomeType.value
})

const showWinnerSelection = computed(() => {
  if (props.scoreA === undefined || props.scoreB === undefined) return true
  return props.scoreA !== props.scoreB
})

const showWinnerSelectionField = computed(() => {
  return !isNormalOutcomeType.value
})

const filteredWinnerOptions = computed(() => {
  if (props.allowDraw) {
    return baseWinnerOptions
  }
  return baseWinnerOptions.filter((option) => option.value !== null)
})

async function loadOutcomeTypes() {
  if (!props.disciplineId && !props.tournamentId) return

  loadingOutcomeTypes.value = true
  try {
    let disciplineId = props.disciplineId
    if (props.tournamentId && !disciplineId) {
      try {
        const tournament = await tournamentApi.getById(props.tournamentId)
        disciplineId = tournament.disciplineId || undefined
      } catch (error) {
        console.error('Erreur lors du chargement du tournoi:', error)
        return
      }
    }
    
    if (disciplineId) {
      outcomeTypes.value = await outcomeTypeApi.list(disciplineId)
    } else {
      outcomeTypes.value = await outcomeTypeApi.list()
    }

    // Auto-select "Normal" type if no type is already selected
    if (!props.outcomeTypeId && outcomeTypes.value.length > 0) {
      const normalType = outcomeTypes.value.find(
        (type) => type.name === outcomeTypeNameEnum.NORMAL
      )
      if (normalType) {
        outcomeTypeIdModel.value = normalType.id
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
    // Merge with existing reasons
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
  // Reset outcome reason when outcome type changes
  outcomeReasonIdModel.value = null
  
  // Load outcome reasons for the selected type
  if (outcomeTypeIdModel.value) {
    loadOutcomeReasons(outcomeTypeIdModel.value)
  }
}

// Watch for outcome type changes to load reasons
watch(outcomeTypeIdModel, (newValue) => {
  if (newValue) {
    loadOutcomeReasons(newValue)
  } else {
    // Clear reasons when no type is selected
    outcomeReasons.value = outcomeReasons.value.filter(
      (r) => r.outcomeTypeId !== newValue
    )
  }
})

onMounted(() => {
  loadOutcomeTypes()
  // If an outcome type is already selected, load its reasons
  if (props.outcomeTypeId) {
    loadOutcomeReasons(props.outcomeTypeId)
  }
})
</script>

<style scoped>
.outcome-selector {
  min-width: 200px;
}
</style>

