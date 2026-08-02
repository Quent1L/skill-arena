<template>
  <div class="space-y-4">
    <div v-for="(item, i) in items" :key="i" class="space-y-1.5">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-300 font-semibold">{{ item.label }}</span>
        <div class="flex items-baseline gap-1.5 tabular-nums">
          <span class="text-gray-400 text-xs">{{
            t('matchOutcomeDistribution.matchCount', { count: item.count })
          }}</span>
          <span class="text-gray-500">•</span>
          <span class="text-gray-400 text-xs">{{ pct(item.count) }} %</span>
        </div>
      </div>

      <div class="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-500"
          :style="{ width: `${pct(item.count)}%` }"
        />
      </div>

      <template v-if="item.wins !== undefined">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
          <span class="flex items-center gap-1.5 text-green-400">
            <span class="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
            {{ t('matchOutcomeDistribution.winsLabel', { count: item.wins }) }} ({{
              segPct(item.wins, item.count)
            }}
            %)
          </span>
          <span v-if="item.draws" class="flex items-center gap-1.5 text-gray-400">
            <span class="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            {{ t('matchOutcomeDistribution.drawsLabel', { count: item.draws }) }} ({{
              segPct(item.draws, item.count)
            }}
            %)
          </span>
          <span class="flex items-center gap-1.5 text-red-400">
            <span class="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
            {{ t('matchOutcomeDistribution.lossesLabel', { count: item.losses ?? 0 }) }} ({{
              segPct(item.losses ?? 0, item.count)
            }}
            %)
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  return Math.round((val / count) * 100)
}
</script>
