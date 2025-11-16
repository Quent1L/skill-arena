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

interface Props {

  tournamentId: string
}


 defineProps<Props>()

const modeOptions = [
  { label: 'Saisir le score', value: 'reported' },
  { label: 'Programmer', value: 'scheduled' },
]

  const modeSelectionModel = defineModel<'reported' | 'scheduled'>('modeSelection',  { default: 'reported' })

  const scoreAModel = defineModel<number>('scoreA', { default: 0 })

  const scoreBModel = defineModel<number>('scoreB', { default: 0 })

  const scheduledDateModel = defineModel<Date | null>('scheduledDate', { default: null })
</script>
