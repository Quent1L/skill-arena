<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
      <i :class="[icon, 'mr-2', iconClass]" />
      {{ title }}
    </h2>
    <div class="space-y-2">
      <div
        v-for="(item, i) in items"
        :key="item.id"
        class="flex items-center gap-3 p-3 rounded-lg"
        :class="i === 0 ? firstRowClass : 'bg-gray-50 dark:bg-gray-800'"
      >
        <span
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          :class="podiumClass(i)"
          >{{ i + 1 }}</span
        >
        <span class="flex-1 font-medium text-gray-900 dark:text-white wrap-break-word min-w-0">{{
          item.displayName
        }}</span>
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ item.secondaryText }}</span>
        <span class="text-sm font-semibold" :class="winRateClass(item.winRate)"
          >{{ item.winRate }}%</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TopPlayerItem {
  id: string
  displayName: string
  secondaryText: string
  winRate: number
}

const props = defineProps<{
  title: string
  icon: string
  iconClass: string
  firstRowClass?: string
  items: TopPlayerItem[]
}>()

const firstRowClass = props.firstRowClass ?? 'bg-gray-50 dark:bg-gray-800'

function podiumClass(i: number) {
  if (i === 0) return 'bg-yellow-400 text-yellow-900'
  if (i === 1) return 'bg-gray-300 text-gray-700'
  return 'bg-amber-600 text-white'
}

function winRateClass(rate: number) {
  if (rate >= 60) return 'text-green-600 dark:text-green-400'
  if (rate >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}
</script>
