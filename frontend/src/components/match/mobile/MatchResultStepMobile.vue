<template>
  <div class="space-y-6 pb-20">
    <!-- Summary -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
      <div class="text-sm text-gray-500 mb-2">{{ formatDate(date) }}</div>
      <div class="flex justify-between items-center">
        <div class="flex-1">
          <div class="font-bold text-lg text-blue-500">{{ teamAName }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ teamAPlayers.join(', ') }}</div>
        </div>
        <div class="px-4 font-bold text-gray-400">VS</div>
        <div class="flex-1">
          <div class="font-bold text-lg text-red-400">{{ teamBName }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ teamBPlayers.join(', ') }}</div>
        </div>
      </div>
    </div>

    <!-- Winner Selection -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <label class="block text-sm font-medium mb-3">Vainqueur</label>
      <div class="grid grid-cols-3 gap-2">
        <Button
          label="Équipe A"
          :severity="winner === 'teamA' ? 'info' : 'secondary'"
          :outlined="winner !== 'teamA'"
          class="w-full"
          @click="winner = 'teamA'"
        />

        <template v-if="allowDraw">
          <Button
            label="Nul"
            severity="info"
            :outlined="!!winner"
            class="w-full"
            @click="winner = null"
          />
        </template>
        <div v-else class="flex items-center justify-center text-gray-300 text-xs">Pas de nul</div>

        <Button
          label="Équipe B"
          severity="secondary"
          :outlined="winner !== 'teamB'"
          class="w-full"
          :class="winner === 'teamB' ? 'bg-red-100 text-red-600 border border-red-300' : ''"
          @click="winner = 'teamB'"
        />
      </div>
    </div>

    <!-- Outcome Type & Reason -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Type de résultat</label>
        <Select
          v-model="outcomeTypeId"
          :options="outcomeTypes"
          option-label="name"
          option-value="id"
          placeholder="Sélectionner un type"
          class="w-full"
          :loading="loadingOutcomeTypes"
          @change="onOutcomeTypeChange"
        />
      </div>

      <div v-if="outcomeTypeId && showOutcomeReasonSelection && filteredOutcomeReasons.length > 0">
        <label class="block text-sm font-medium mb-2">Raison</label>
        <Select
          v-model="outcomeReasonId"
          :options="filteredOutcomeReasons"
          option-label="name"
          option-value="id"
          placeholder="Sélectionner une raison"
          class="w-full"
          :loading="loadingOutcomeReasons"
        />
      </div>
    </div>

    <!-- Score -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <label class="block text-sm font-medium mb-3">Score</label>
      <div class="flex items-center justify-center gap-4">
        <div class="flex flex-col items-center">
          <span class="text-xs text-blue-500 font-bold mb-1">Équipe A</span>
          <InputNumber
            v-model="scoreA"
            showButtons
            buttonLayout="vertical"
            style="width: 4rem"
            :min="0"
            inputClass="text-center font-bold text-xl"
            :input-props="{ readonly: true }"
          />
        </div>
        <span class="text-2xl font-bold text-gray-300 mt-5">-</span>
        <div class="flex flex-col items-center">
          <span class="text-xs text-red-400 font-bold mb-1">Équipe B</span>
          <InputNumber
            v-model="scoreB"
            showButtons
            buttonLayout="vertical"
            style="width: 4rem"
            :min="0"
            inputClass="text-center font-bold text-xl"
            :input-props="{ readonly: true }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import { outcomeReasonApi } from '@/composables/outcome-reason.api'
import { tournamentApi } from '@/composables/tournament.api'
import {
  outcomeTypeNameEnum,
  type OutcomeReason,
  type OutcomeType,
} from '@skill-arena/shared/types/index'

interface Props {
  teamAPlayers: string[]
  teamBPlayers: string[]
  date?: Date | null
  allowDraw?: boolean
  tournamentId: string
}

const props = defineProps<Props>()

const scoreA = defineModel<number>('scoreA', { default: 0 })
const scoreB = defineModel<number>('scoreB', { default: 0 })
const winner = defineModel<'teamA' | 'teamB' | null>('winner')
const outcomeTypeId = defineModel<string | null>('outcomeTypeId', { default: null })
const outcomeReasonId = defineModel<string | null>('outcomeReasonId', { default: null })

const teamAName = 'Équipe A'
const teamBName = 'Équipe B'

const outcomeTypes = ref<OutcomeType[]>([])
const outcomeReasons = ref<OutcomeReason[]>([])
const loadingOutcomeTypes = ref(false)
const loadingOutcomeReasons = ref(false)

const filteredOutcomeReasons = computed(() => {
  if (!outcomeTypeId.value) return []
  return outcomeReasons.value.filter((reason) => reason.outcomeTypeId === outcomeTypeId.value)
})

const selectedOutcomeType = computed(() => {
  if (!outcomeTypeId.value) return null
  return outcomeTypes.value.find((type) => type.id === outcomeTypeId.value)
})

const isNormalOutcomeType = computed(() => {
  return selectedOutcomeType.value?.name === outcomeTypeNameEnum.NORMAL
})

const showOutcomeReasonSelection = computed(() => {
  return !isNormalOutcomeType.value
})

async function loadOutcomeTypes() {
  if (!props.tournamentId) return

  loadingOutcomeTypes.value = true
  try {
    const tournament = await tournamentApi.getById(props.tournamentId)
    const disciplineId = tournament.disciplineId || undefined

    if (disciplineId) {
      outcomeTypes.value = await outcomeTypeApi.list(disciplineId)
    } else {
      outcomeTypes.value = await outcomeTypeApi.list()
    }

    // Auto-select "Normal" type if no type is already selected
    if (!outcomeTypeId.value && outcomeTypes.value.length > 0) {
      const normalType = outcomeTypes.value.find((type) => type.name === outcomeTypeNameEnum.NORMAL)
      if (normalType) {
        outcomeTypeId.value = normalType.id
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des types de résultat:', error)
  } finally {
    loadingOutcomeTypes.value = false
  }
}

async function loadOutcomeReasons(typeId: string) {
  loadingOutcomeReasons.value = true
  try {
    const reasons = await outcomeReasonApi.list(typeId)
    outcomeReasons.value = [
      ...outcomeReasons.value.filter((r) => r.outcomeTypeId !== typeId),
      ...reasons,
    ]
  } catch (error) {
    console.error('Erreur lors du chargement des raisons de résultat:', error)
  } finally {
    loadingOutcomeReasons.value = false
  }
}

function onOutcomeTypeChange() {
  outcomeReasonId.value = null
  if (outcomeTypeId.value) {
    loadOutcomeReasons(outcomeTypeId.value)
  }
}

watch(outcomeTypeId, (newValue) => {
  if (newValue) {
    loadOutcomeReasons(newValue)
  } else {
    outcomeReasons.value = outcomeReasons.value.filter((r) => r.outcomeTypeId !== newValue)
  }
})

function formatDate(date?: Date | null) {
  if (!date) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

onMounted(() => {
  loadOutcomeTypes()
  if (outcomeTypeId.value) {
    loadOutcomeReasons(outcomeTypeId.value)
  }
})
</script>
