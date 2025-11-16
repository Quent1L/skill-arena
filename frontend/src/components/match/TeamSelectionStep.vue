<template>
  <div class="p-6">
    <!-- Date picker en haut -->
    <div class="mb-6">
      <label for="match-date-time" class="block text-sm font-medium mb-2">
        Date et heure du match <span class="text-red-500">*</span>
      </label>
      <DatePicker
        id="match-date-time"
        v-model="scheduledDate"
        show-time
        hour-format="24"
        icon-display="input"
        showIcon
        showButtonBar
        :min-date="minDate ?? undefined"
        :max-date="maxDate ?? undefined"
      />
    </div>

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
      v-if="isFutureDate"
      label="Programmer le match"
      icon="fas fa-calendar-check"
      @click="onCreate"
      :disabled="disabled || !scheduledDate"
      class="bg-green-600 hover:bg-green-700"
    />
    <Button
      v-else
      label="Suivant"
      icon="fas fa-arrow-right"
      iconPos="right"
      @click="onNext"
      :disabled="disabled || !scheduledDate"
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
  minDate?: Date | null
  maxDate?: Date | null
  validation?: ValidationResult
  disabled?: boolean
}

interface Emits {
  (e: 'validate'): void
  (e: 'next'): void
  (e: 'create'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const playerIdsAModel = defineModel<string[]>('playerIdsA', { required: true })
const playerIdsBModel = defineModel<string[]>('playerIdsB', { required: true })
const scheduledDate = defineModel<Date | null>('scheduledDate', { default: null })
const now = new Date()

// Check if selected date is in the future
const isFutureDate = computed(() => {
  if (!scheduledDate.value) return false
  return scheduledDate.value > now
})

function onValidate() {
  emit('validate')
}

function onNext() {
  emit('next')
}

function onCreate() {
  emit('create')
}
</script>
