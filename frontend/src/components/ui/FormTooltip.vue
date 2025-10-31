<template>
  <div class="inline-flex items-center gap-1">
    <label v-if="label" :for="forId" class="block text-sm font-medium">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <i
      v-if="tooltip"
      v-tooltip.top="tooltip"
      class="fa-solid fa-circle-info cursor-help text-xs"
      aria-label="Information"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  tooltip?: string
  forId?: string
  required?: boolean
}

defineProps<Props>()
</script>
