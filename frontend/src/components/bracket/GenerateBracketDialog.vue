<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isRegeneration ? 'Regenerate Bracket' : 'Generate Bracket'"
    :style="{ width: '90vw', maxWidth: '600px' }"
    :draggable="false"
  >
    <div class="space-y-6 py-4">
      <!-- Warning for regeneration -->
      <Message
        v-if="isRegeneration"
        severity="warn"
        :closable="false"
        class="mb-4"
      >
        <template #messageicon>
          <i class="fa fa-exclamation-triangle mr-2" />
        </template>
        <p class="font-semibold">Warning: This will delete all existing matches!</p>
        <p class="text-sm mt-1">
          All current bracket matches will be removed and a new bracket will be generated.
        </p>
      </Message>

      <!-- Bracket Type -->
      <div class="space-y-2">
        <label class="block font-medium text-sm text-gray-700 dark:text-gray-300">
          Bracket Type
        </label>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="border rounded-lg p-4 cursor-pointer transition-all"
            :class="
              formData.bracketType === 'single_elimination'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            "
            @click="formData.bracketType = 'single_elimination'"
          >
            <i class="fa fa-trophy text-2xl mb-2 block text-blue-600" />
            <div class="font-medium">Single Elimination</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              One loss and you're out
            </div>
          </div>

          <div
            class="border rounded-lg p-4 cursor-pointer transition-all"
            :class="
              formData.bracketType === 'double_elimination'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            "
            @click="formData.bracketType = 'double_elimination'"
          >
            <i class="fa fa-shield-alt text-2xl mb-2 block text-green-600" />
            <div class="font-medium">Double Elimination</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Second chance via losers bracket
            </div>
          </div>
        </div>
      </div>

      <!-- Seeding Type -->
      <div class="space-y-2">
        <label class="block font-medium text-sm text-gray-700 dark:text-gray-300">
          Seeding Method
        </label>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="border rounded-lg p-4 cursor-pointer transition-all"
            :class="
              formData.seedingType === 'random'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            "
            @click="
              formData.seedingType = 'random';
              formData.sourceTournamentId = undefined
            "
          >
            <i class="fa fa-random text-2xl mb-2 block text-purple-600" />
            <div class="font-medium">Random</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Participants randomly ordered
            </div>
          </div>

          <div
            class="border rounded-lg p-4 cursor-pointer transition-all"
            :class="
              formData.seedingType === 'championship_based'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            "
            @click="formData.seedingType = 'championship_based'"
          >
            <i class="fa fa-medal text-2xl mb-2 block text-yellow-600" />
            <div class="font-medium">Championship</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Based on previous standings
            </div>
          </div>
        </div>
      </div>

      <!-- Source Tournament (championship seeding only) -->
      <div v-if="formData.seedingType === 'championship_based'" class="space-y-2">
        <label for="source-tournament" class="block font-medium text-sm text-gray-700 dark:text-gray-300">
          Source Tournament
        </label>
        <Dropdown
          id="source-tournament"
          v-model="formData.sourceTournamentId"
          :options="finishedTournaments"
          option-label="name"
          option-value="id"
          placeholder="Select source tournament"
          :loading="loadingTournaments"
          class="w-full"
          show-clear
        >
          <template #value="slotProps">
            <div v-if="slotProps.value">
              {{ finishedTournaments.find((t) => t.id === slotProps.value)?.name }}
            </div>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
        </Dropdown>
        <small class="text-gray-600 dark:text-gray-400">
          Select a finished tournament to use its standings for seeding
        </small>
      </div>

      <!-- Bronze Match (single elimination only) -->
      <div v-if="formData.bracketType === 'single_elimination'" class="flex items-center">
        <Checkbox
          id="bronze-match"
          v-model="formData.hasBronzeMatch"
          :binary="true"
          class="mr-2"
        />
        <label for="bronze-match" class="cursor-pointer text-sm">
          Include bronze medal match (3rd place)
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" severity="secondary" @click="close" />
        <Button
          :label="isRegeneration ? 'Regenerate' : 'Generate'"
          :loading="loading"
          :disabled="!isFormValid"
          @click="handleSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { GenerateBracketInput } from '@skill-arena/shared'
import { tournamentApi } from '@/composables/tournament/tournament.api'
import type { TournamentResponse } from '@/composables/tournament/tournament.api'

interface Props {
  modelValue: boolean
  isRegeneration?: boolean
  currentDisciplineId?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', data: GenerateBracketInput): void
}

const props = withDefaults(defineProps<Props>(), {
  isRegeneration: false,
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const loading = ref(false)
const loadingTournaments = ref(false)
const finishedTournaments = ref<TournamentResponse[]>([])

const formData = ref<GenerateBracketInput>({
  bracketType: 'single_elimination',
  seedingType: 'random',
  hasBronzeMatch: false,
})

const isFormValid = computed(() => {
  if (formData.value.seedingType === 'championship_based') {
    return !!formData.value.sourceTournamentId
  }
  return true
})

// Load finished tournaments when championship seeding is selected
watch(
  () => formData.value.seedingType,
  async (newType) => {
    if (newType === 'championship_based' && finishedTournaments.value.length === 0) {
      await loadFinishedTournaments()
    }
  }
)

// Load finished tournaments on mount if already championship_based
watch(
  visible,
  async (isVisible) => {
    if (
      isVisible &&
      formData.value.seedingType === 'championship_based' &&
      finishedTournaments.value.length === 0
    ) {
      await loadFinishedTournaments()
    }
  },
  { immediate: true }
)

async function loadFinishedTournaments() {
  loadingTournaments.value = true
  try {
    const tournaments = await tournamentApi.list({ status: 'finished' })

    // Filter by discipline if provided
    finishedTournaments.value = props.currentDisciplineId
      ? tournaments.filter((t) => t.disciplineId === props.currentDisciplineId)
      : tournaments
  } catch (error) {
    console.error('Failed to load finished tournaments:', error)
  } finally {
    loadingTournaments.value = false
  }
}

function handleSubmit() {
  if (!isFormValid.value) return

  loading.value = true
  emit('submit', formData.value)

  // Note: Loading state will be reset when dialog is closed by parent
}

function close() {
  visible.value = false
  loading.value = false
}

// Reset form when dialog opens
watch(visible, (isVisible) => {
  if (isVisible) {
    formData.value = {
      bracketType: 'single_elimination',
      seedingType: 'random',
      hasBronzeMatch: false,
    }
  } else {
    loading.value = false
  }
})
</script>

<style scoped>
/* Additional custom styles if needed */
</style>
