<template>
  <div class="p-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div>
        <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <h4 class="text-sm font-semibold mb-2">Équipe A</h4>
          <TeamSelector
            v-model="playerIdsAModel"
            :tournament-id="tournamentId"
            @validate="onValidate"
          />
        </div>
      </div>

      <div>
        <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <h4 class="text-sm font-semibold mb-2">Équipe B</h4>
          <TeamSelector
            v-model="playerIdsBModel"
            :tournament-id="tournamentId"
            @validate="onValidate"
          />
        </div>
      </div>
    </div>

    <Message
      v-if="validation && !validation.valid && validation.errors && validation.errors.length > 0"
      severity="error"
      class="mt-4"
      :closable="false"
    >
      <ul class="list-disc list-inside">
        <li v-for="error in validation.errors" :key="error">
          {{ error }}
        </li>
      </ul>
    </Message>
  </div>
  <div class="flex pt-4 justify-end">
    <Button
      label="Suivant"
      icon="fas fa-arrow-right"
      iconPos="right"
      @click="onNext"
      :disabled="disabled"
      class="bg-blue-600 hover:bg-blue-700"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TeamSelector from '@/components/TeamSelector.vue'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface Props {
  tournamentId: string
  playerIdsA: string[]
  playerIdsB: string[]
  validation?: ValidationResult
  disabled?: boolean
}

interface Emits {
  (e: 'update:playerIdsA', value: string[]): void
  (e: 'update:playerIdsB', value: string[]): void
  (e: 'validate'): void
  (e: 'next'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const playerIdsAModel = computed({
  get: () => props.playerIdsA,
  set: (value) => emit('update:playerIdsA', value),
})

const playerIdsBModel = computed({
  get: () => props.playerIdsB,
  set: (value) => emit('update:playerIdsB', value),
})

function onValidate() {
  emit('validate')
}

function onNext() {
  emit('next')
}
</script>
