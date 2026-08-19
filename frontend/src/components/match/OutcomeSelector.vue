<template>
  <div class="outcome-selector flex flex-col gap-4">
    <!-- Outcome Type Selection -->
    <div class="flex flex-col gap-2">
      <label for="outcome-type" class="text-xs text-gray-500">{{ t('outcomeSelector.outcomeTypeLabel') }}</label>
      <Select
        id="outcome-type"
        v-model="outcomeTypeIdModel"
        :options="outcomeTypes"
        option-label="name"
        option-value="id"
        :placeholder="t('outcomeSelector.outcomeTypePlaceholder')"
        class="w-full"
        :loading="loadingOutcomeTypes"
        @change="onOutcomeTypeChange"
      />
    </div>

    <!-- Outcome Reason Selection (only if outcome type is selected, not "Normal", and has reasons) -->
    <div
      v-if="outcomeTypeIdModel && showOutcomeReasonSelection && filteredOutcomeReasons.length > 0"
      class="flex flex-col gap-2"
    >
      <label for="outcome-reason" class="text-xs text-gray-500">{{ t('outcomeSelector.outcomeReasonLabel') }}</label>
      <Select
        id="outcome-reason"
        v-model="outcomeReasonIdModel"
        :options="filteredOutcomeReasons"
        option-label="name"
        option-value="id"
        :placeholder="t('outcomeSelector.outcomeReasonPlaceholder')"
        class="w-full"
        :loading="loadingOutcomeReasons"
      />
    </div>

    <!-- Winner Selection (only if outcome type is selected, not "Normal", and scores are different) -->
    <div
      v-if="outcomeTypeIdModel && showWinnerSelection && showWinnerSelectionField"
      class="flex flex-col gap-2"
    >
      <span class="text-xs text-gray-500">{{ t('outcomeSelector.winnerLabel') }}</span>
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
import { useI18n } from 'vue-i18n'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { tournamentApi } from '@/composables/tournament/tournament.api'
import {
  selectableRulesetOutcomes,
  type OutcomeReason,
  type OutcomeType,
  type RulesetOutcomeType,
} from '@skol-arena/shared/types/index'

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

const { t } = useI18n()

const outcomeTypes = ref<OutcomeType[]>([])
const outcomeReasons = ref<OutcomeReason[]>([])
const loadingOutcomeTypes = ref(false)
const loadingOutcomeReasons = ref(false)

const baseWinnerOptions = computed(() => [
  { label: t('outcomeSelector.teamA'), value: 'teamA' },
  { label: t('outcomeSelector.teamB'), value: 'teamB' },
  { label: t('outcomeSelector.draw'), value: null },
])

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
  return outcomeReasons.value.filter((reason) => reason.outcomeTypeId === outcomeTypeIdModel.value)
})

const selectedOutcomeType = computed(() => {
  if (!outcomeTypeIdModel.value) return null
  return outcomeTypes.value.find((type) => type.id === outcomeTypeIdModel.value)
})

/**
 * The default outcome needs no reason and no explicit winner. Read from the
 * `isDefault` flag rather than by matching the name "Normal", which broke as soon
 * as an admin renamed the type.
 */
const isNormalOutcomeType = computed(() => {
  return selectedOutcomeType.value?.isDefault === true
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
    return baseWinnerOptions.value
  }
  return baseWinnerOptions.value.filter((option) => option.value !== null)
})

/**
 * Inside a competition the choices come from its ruleset snapshot, not from the
 * live discipline. Offering a type the snapshot does not know would produce a
 * match whose outcome cannot be resolved — the exact orphaning the snapshot
 * exists to prevent. Archived types are filtered out here but stay resolvable on
 * matches already tagged with them.
 */
async function loadOutcomeTypes() {
  if (!props.disciplineId && !props.tournamentId) return

  loadingOutcomeTypes.value = true
  try {
    if (props.tournamentId) {
      const { payload } = await tournamentApi.getRuleset(props.tournamentId)
      outcomeTypes.value = selectableRulesetOutcomes(payload).map(toOutcomeType)
      // The reasons travel with the payload, so no follow-up request per type.
      outcomeReasons.value = selectableRulesetOutcomes(payload).flatMap((type) =>
        type.reasons.map((reason) => ({ ...reason, outcomeTypeId: type.id })),
      )
    } else if (props.disciplineId) {
      outcomeTypes.value = await outcomeTypeApi.list(props.disciplineId)
    }

    autoSelectDefaultType()
  } catch (error) {
    console.error('Erreur lors du chargement des types de résultat:', error)
  } finally {
    loadingOutcomeTypes.value = false
  }
}

function toOutcomeType(outcome: RulesetOutcomeType): OutcomeType {
  return {
    id: outcome.id,
    disciplineId: props.disciplineId ?? '',
    name: outcome.name,
    isDefault: outcome.isDefault,
    scoreCountsForMmr: outcome.scoreCountsForMmr,
    points: outcome.points,
    mmrMultiplier: outcome.mmrMultiplier,
  }
}

/**
 * Preselects the discipline's default outcome. Keyed on `isDefault` rather than
 * on the name: matching the literal "Normal" broke the moment an admin renamed
 * the type, silently leaving new matches with no outcome preselected.
 */
function autoSelectDefaultType() {
  if (props.outcomeTypeId || outcomeTypes.value.length === 0) return
  const defaultType = outcomeTypes.value.find((type) => type.isDefault)
  if (defaultType) {
    outcomeTypeIdModel.value = defaultType.id
  }
}

async function loadOutcomeReasons(outcomeTypeId: string) {
  // Already carried by the ruleset payload for a competition.
  if (props.tournamentId) return

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
    outcomeReasons.value = outcomeReasons.value.filter((r) => r.outcomeTypeId !== newValue)
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
