<template>
  <div class="mt-4 w-full">
    <div class="flex items-center justify-center">
      <SelectButton
        v-model="modeSelectionModel"
        :options="modeOptions"
        optionLabel="label"
        optionValue="value"
        class="mb-4"
      />
    </div>

    <div class="flex items-center justify-center gap-8">
      <div v-if="modeSelectionModel === 'reported'" class="flex items-center gap-8">
        <div class="text-center">
          <div class="text-xs text-gray-500">Score A</div>
          <InputNumber
            v-model="scoreAModel"
            :min="0"
            class="text-2xl font-bold"
            input-class="w-20 text-center"
          />
        </div>
        <div class="text-lg text-gray-600">vs</div>
        <div class="text-center">
          <div class="text-xs text-gray-500">Score B</div>
          <InputNumber
            v-model="scoreBModel"
            :min="0"
            class="text-2xl font-bold"
            input-class="w-20 text-center"
          />
        </div>
      </div>

      <div v-else class="">
        <label for="scheduled-date-inline" class="block text-sm font-medium mb-2"
          >Date et heure du match</label
        >
        <DatePicker
          id="scheduled-date-inline"
          v-model="scheduledDateModel"
          show-time
          hour-format="24"
          class="w-full"
          icon-display="input"
          showIcon
          :min-date="new Date()"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modeSelection: 'reported' | 'scheduled'
  scoreA: number
  scoreB: number
  scheduledDate: Date | null
}

interface Emits {
  (e: 'update:modeSelection', value: 'reported' | 'scheduled'): void
  (e: 'update:scoreA', value: number): void
  (e: 'update:scoreB', value: number): void
  (e: 'update:scheduledDate', value: Date | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const modeOptions = [
  { label: 'Saisir le score', value: 'reported' },
  { label: 'Programmer', value: 'scheduled' },
]

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
</script>
