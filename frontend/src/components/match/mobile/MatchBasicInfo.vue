<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4"
  >
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >Date et Heure</label
      >
      <DatePicker
        v-model="modelValue"
        show-time
        hour-format="24"
        touch-ui
        class="w-full"
        input-class="w-full"
        placeholder="Sélectionner la date"
        :min-date="minDate"
        :max-date="maxDate"
        showButtonBar
        manualInput
      >
        <template #buttonbar="{ clearCallback }">
          <div class="flex justify-between w-full">
            <Button size="small" severity="secondary" label="Aujourd'hui" @click="modelValue = new Date()" variant="text" />
            <Button
              size="small"
              label="Effacer"
              severity="secondary"
              variant="text"
              @click="clearCallback"
            />
          </div>
        </template>
      </DatePicker>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  minDate?: Date
  maxDate?: Date
}

defineProps<Props>()
const modelValue = defineModel<Date | null>()
</script>
