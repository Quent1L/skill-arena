<template>
  <div class="pt-6">
    <OutcomeSelector
      v-model:outcome-type-id="outcomeTypeIdModel"
      v-model:outcome-reason-id="outcomeReasonIdModel"
      v-model:winner="winnerModel"
      :tournament-id="tournamentId"
      :score-a="scoreA"
      :score-b="scoreB"
      :allow-draw="allowDraw"
    />

    <div class="flex pt-6 justify-between">
      <Button
        label="Précédent"
        severity="secondary"
        icon="fas fa-arrow-left"
        @click="onPrevious"
      />
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
import OutcomeSelector from './OutcomeSelector.vue'

interface Props {
  tournamentId: string
  scoreA: number
  scoreB: number
  outcomeTypeId?: string | null
  outcomeReasonId?: string | null
  winner?: 'teamA' | 'teamB' | null
  allowDraw?: boolean
  loading?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'previous'): void
  (e: 'create'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const outcomeTypeIdModel = defineModel<string | null>('outcomeTypeId', { default: null })
const outcomeReasonIdModel = defineModel<string | null>('outcomeReasonId', { default: null })
const winnerModel = defineModel<'teamA' | 'teamB' | null>('winner', { default: null })

function onPrevious() {
  emit('previous')
}

function onCreate() {
  emit('create')
}
</script>


