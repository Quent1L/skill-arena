<template>
  <div class="pt-6">
    <TeamPreview :team-a-players="teamAPlayers" :team-b-players="teamBPlayers" />

    <ScoreInput
      v-model:mode-selection="modeSelectionModel"
      v-model:score-a="scoreAModel"
      v-model:score-b="scoreBModel"
      v-model:scheduled-date="scheduledDateModel"
    />

    <div class="flex pt-6 justify-between">
      <Button label="Précédent" severity="secondary" icon="fas fa-arrow-left" @click="onPrevious" />
      <Button
        label="Créer le match"
        icon="fas fa-check"
        @click="onCreate"
        :loading="loading"
        :disabled="disabled"
        class="bg-green-600 hover:bg-green-700"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TeamPreview from './TeamPreview.vue'
import ScoreInput from './ScoreInput.vue'

interface Props {
  teamAPlayers: string[]
  teamBPlayers: string[]
  modeSelection: 'reported' | 'scheduled'
  scoreA: number
  scoreB: number
  scheduledDate: Date | null
  loading?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:modeSelection', value: 'reported' | 'scheduled'): void
  (e: 'update:scoreA', value: number): void
  (e: 'update:scoreB', value: number): void
  (e: 'update:scheduledDate', value: Date | null): void
  (e: 'previous'): void
  (e: 'create'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const modeSelectionModel = computed({
  get: () => props.modeSelection,
  set: (value) => emit('update:modeSelection', value),
})

const scoreAModel = computed({
  get: () => props.scoreA,
  set: (value) => emit('update:scoreA', value),
})

const scoreBModel = computed({
  get: () => props.scoreB,
  set: (value) => emit('update:scoreB', value),
})

const scheduledDateModel = computed({
  get: () => props.scheduledDate,
  set: (value) => emit('update:scheduledDate', value),
})

function onPrevious() {
  emit('previous')
}

function onCreate() {
  emit('create')
}
</script>
