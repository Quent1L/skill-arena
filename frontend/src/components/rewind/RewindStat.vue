<template>
  <div class="flex flex-col items-center gap-1 rounded-2xl bg-white/5 px-4 py-4">
    <span class="text-3xl font-black tabular-nums" :class="valueClass">
      {{ prefix }}{{ display }}{{ suffix }}
    </span>
    <span class="text-center text-xs uppercase tracking-wide text-gray-400">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useCountUp } from '@/composables/ui/useCountUp'

const props = withDefaults(
  defineProps<{
    value: number
    label: string
    /** Rendered before the number, e.g. '+' for a positive delta. */
    prefix?: string
    suffix?: string
    valueClass?: string
    from?: number
  }>(),
  { prefix: '', suffix: '', valueClass: 'text-white', from: 0 },
)

const { value: display } = useCountUp(toRef(props, 'value'), { from: props.from })
</script>
