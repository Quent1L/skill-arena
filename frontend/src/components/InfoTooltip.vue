<template>
  <button
    type="button"
    class="text-gray-500 hover:text-gray-300 text-xs focus:outline-none focus-visible:outline-none cursor-help leading-none"
    v-tooltip.focus.top="tooltipValue"
    @mouseenter="($event.currentTarget as HTMLElement).focus()"
    @mouseleave="($event.currentTarget as HTMLElement).blur()"
  >
    <i class="fa fa-circle-question" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string; html?: boolean }>()

const tooltipValue = computed(() =>
  props.html ? { value: props.text, escape: false } : props.text,
)
</script>

<style scoped>
button:focus-visible {
  outline: none;
}
</style>
