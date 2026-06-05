<template>
  <div class="space-y-2">
    <div v-for="(item, i) in items" :key="i" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }"
          />
          <span class="text-gray-300">{{ item.label }}</span>
        </div>
        <div class="flex items-center gap-3 tabular-nums">
          <span class="text-white font-semibold">{{ item.count }}</span>
          <span class="text-gray-400 w-10 text-right">{{ pct(item.count) }}%</span>
        </div>
      </div>
      <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :style="{
            width: `${pct(item.count)}%`,
            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

const props = defineProps<{
  items: Array<{ label: string; count: number }>
}>()

const total = computed(() => props.items.reduce((s, i) => s + i.count, 0))

function pct(count: number): number {
  if (total.value === 0) return 0
  return Math.round((count / total.value) * 100)
}
</script>
