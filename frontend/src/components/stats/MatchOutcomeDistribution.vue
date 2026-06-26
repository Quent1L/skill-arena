<template>
  <div class="space-y-2">
    <div v-for="(item, i) in items" :key="i" class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: item.wins !== undefined ? '#6b7280' : PIE_COLORS[i % PIE_COLORS.length] }"
          />
          <span class="text-gray-300">{{ item.label }}</span>
        </div>
        <div class="flex items-center gap-3 tabular-nums">
          <span class="text-gray-400 text-right">{{ pct(item.count) }}%</span>
          <template v-if="item.wins !== undefined">
            <span class="text-green-400 text-xs">{{ t('matchOutcomeDistribution.winsCount', { count: item.wins }) }}</span>
            <span v-if="item.draws" class="text-gray-400 text-xs">{{ t('matchOutcomeDistribution.drawsCount', { count: item.draws }) }}</span>
            <span class="text-red-400 text-xs">{{ t('matchOutcomeDistribution.lossesCount', { count: item.losses ?? 0 }) }}</span>
          </template>
          <template v-else>
            <span class="text-gray-400 text-xs">({{ item.count }})</span>
          </template>
        </div>
      </div>
      <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div class="h-full transition-all duration-500" :style="{ width: `${pct(item.count)}%` }">
          <template v-if="item.wins !== undefined">
            <div class="h-full flex">
              <div class="h-full bg-green-500 transition-all duration-500" :style="{ width: `${segPct(item.wins, item.count)}%` }" />
              <div class="h-full bg-gray-400 transition-all duration-500" :style="{ width: `${segPct(item.draws ?? 0, item.count)}%` }" />
              <div class="h-full bg-red-500 transition-all duration-500" :style="{ width: `${segPct(item.losses ?? 0, item.count)}%` }" />
            </div>
          </template>
          <template v-else>
            <div
              class="h-full rounded-full"
              :style="{ width: '100%', backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

type Item = { label: string; count: number; wins?: number; losses?: number; draws?: number }

const props = defineProps<{
  items: Array<Item>
}>()

const total = computed(() => props.items.reduce((s, i) => s + i.count, 0))

function pct(count: number): number {
  if (total.value === 0) return 0
  return Math.round((count / total.value) * 100)
}

function segPct(val: number, count: number): number {
  if (count === 0) return 0
  return (val / count) * 100
}
</script>
