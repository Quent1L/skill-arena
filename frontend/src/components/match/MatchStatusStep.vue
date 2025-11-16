<template>
  <div class="pt-6">
    <TeamPreview :team-a-players="teamAPlayers" :team-b-players="teamBPlayers" />

    <ScoreInput
      v-model:mode-selection="modeSelectionModel"
      v-model:score-a="scoreAModel"
      v-model:score-b="scoreBModel"
      v-model:scheduled-date="scheduledDateModel"
      :tournament-id="tournamentId"
    />

    <div class="flex pt-6 justify-between">
      <Button label="Précédent" severity="secondary" icon="fas fa-arrow-left" @click="onPrevious" />
      <Button
        v-if="modeSelectionModel === 'scheduled'"
        label="Créer le match"
        icon="fas fa-check"
        @click="onCreate"
        :loading="loading"
        :disabled="disabled"
        class="bg-green-600 hover:bg-green-700"
      />
      <Button
        v-else
        label="Suivant"
        icon="fas fa-arrow-right"
        iconPos="right"
        @click="onNext"
        :loading="loading"
        :disabled="disabled || !canProceedToOutcomeStep"
        class="bg-blue-600 hover:bg-blue-700"
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
  tournamentId: string
  allowDraw?: boolean
  loading?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'previous'): void
  (e: 'next'): void
  (e: 'create'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const modeSelectionModel = defineModel<'reported' | 'scheduled'>('modeSelection', { required: true })
const scoreAModel = defineModel<number>('scoreA', { required: true })
const scoreBModel = defineModel<number>('scoreB', { required: true })
const scheduledDateModel = defineModel<Date | null>('scheduledDate', { default: null })

const canProceedToOutcomeStep = computed(() => {
  // Can proceed only if mode is 'reported' and scores are set
  if (modeSelectionModel.value !== 'reported') return false
  return scoreAModel.value > 0 || scoreBModel.value > 0
})

function onPrevious() {
  emit('previous')
}

function onNext() {
  emit('next')
}

function onCreate() {
  emit('create')
}
</script>
