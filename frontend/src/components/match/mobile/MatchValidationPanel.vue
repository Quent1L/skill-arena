<template>
  <div
    v-if="hasErrors"
    class="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-r-lg my-4"
  >
    <div class="flex items-start">
      <i class="fas fa-exclamation-triangle text-orange-500 mt-1 mr-3"></i>
      <div>
        <h4 class="text-sm font-semibold text-orange-800 dark:text-orange-200">
          Le match n'est pas valide
        </h4>
        <ul class="mt-2 text-sm text-orange-700 dark:text-orange-300 list-disc list-inside">
          <li v-for="(error, index) in errors" :key="index">
            {{ error }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface Props {
  validation?: ValidationResult | null
}

const props = defineProps<Props>()

const hasErrors = computed(() => {
  return props.validation && !props.validation.valid && props.validation.errors.length > 0
})

const errors = computed(() => {
  return props.validation?.errors || []
})
</script>
