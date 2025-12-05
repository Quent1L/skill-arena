<template>
  <div class="bracket-navigation">
    <!-- Bracket Type Tabs (for double elimination) -->
    <div v-if="isDoubleElimination" class="flex justify-center mb-4">
      <SelectButton
        v-model="selectedBracketType"
        :options="bracketTypeOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
      />
    </div>

    <!-- Round Navigation -->
    <div class="flex items-center justify-center gap-4">
      <Button
        icon="fa fa-chevron-left"
        text
        rounded
        :disabled="!canGoPrevious"
        @click="previousRound"
        aria-label="Round précédent"
      />

      <div class="text-center min-w-[120px]">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ currentRoundLabel }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 block">
          {{ currentRoundIndex + 1 }} / {{ totalRounds }}
        </span>
      </div>

      <Button
        icon="fa fa-chevron-right"
        text
        rounded
        :disabled="!canGoNext"
        @click="nextRound"
        aria-label="Round suivant"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentRoundIndex: number
  totalRounds: number
  currentRoundLabel: string
  isDoubleElimination: boolean
  selectedBracketType: 'winner' | 'loser' | 'grand_final'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:currentRoundIndex': [value: number]
  'update:selectedBracketType': [value: 'winner' | 'loser' | 'grand_final']
}>()

const selectedBracketType = computed({
  get: () => props.selectedBracketType,
  set: (value) => emit('update:selectedBracketType', value),
})

const bracketTypeOptions = [
  { label: 'Winner', value: 'winner' },
  { label: 'Loser', value: 'loser' },
  { label: 'Finale', value: 'grand_final' },
]

const canGoPrevious = computed(() => props.currentRoundIndex > 0)
const canGoNext = computed(() => props.currentRoundIndex < props.totalRounds - 1)

function previousRound() {
  if (canGoPrevious.value) {
    emit('update:currentRoundIndex', props.currentRoundIndex - 1)
  }
}

function nextRound() {
  if (canGoNext.value) {
    emit('update:currentRoundIndex', props.currentRoundIndex + 1)
  }
}
</script>
