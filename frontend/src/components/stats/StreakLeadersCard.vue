<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
    <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">
      <i :class="[icon, 'mr-2', variantClasses.icon]" />
      {{ title }}
    </h2>
    <div class="space-y-2">
      <div
        v-for="entry in visibleEntries"
        :key="entry.playerId"
        class="flex items-center gap-3 p-3 rounded-lg"
        :class="variantClasses.row"
      >
        <i :class="[icon, variantClasses.icon, 'text-lg']" />
        <span class="flex-1 font-medium text-gray-900 dark:text-white wrap-break-word min-w-0">{{
          entry.displayName
        }}</span>
        <span class="font-bold text-lg" :class="variantClasses.value">{{
          entry.currentStreak
        }}</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ unitLabel }}</span>
      </div>
    </div>
    <button
      v-if="hiddenCount > 0"
      type="button"
      class="mt-3 w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <i :class="expanded ? 'fa fa-chevron-up' : 'fa fa-chevron-down'" class="mr-2" />
      {{ expanded ? t('common.showLess') : t('common.showMore', { count: hiddenCount }) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WinStreakEntry } from '@skol-arena/shared'

export type StreakVariant = 'orange' | 'red' | 'blue'

/** Tailwind needs the class names spelled out, so each variant lists them in full. */
const VARIANTS: Record<StreakVariant, { icon: string; row: string; value: string }> = {
  orange: {
    icon: 'text-orange-500',
    row: 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800',
    value: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    icon: 'text-red-500',
    row: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
    value: 'text-red-600 dark:text-red-400',
  },
  blue: {
    icon: 'text-blue-500',
    row: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
    value: 'text-blue-600 dark:text-blue-400',
  },
}

const props = withDefaults(
  defineProps<{
    title: string
    icon: string
    variant: StreakVariant
    entries: WinStreakEntry[]
    unitLabel: string
    collapsedCount?: number
  }>(),
  { collapsedCount: 3 },
)

const { t } = useI18n()

const expanded = ref(false)

const variantClasses = computed(() => VARIANTS[props.variant])

const visibleEntries = computed(() =>
  expanded.value ? props.entries : props.entries.slice(0, props.collapsedCount),
)

const hiddenCount = computed(() => Math.max(0, props.entries.length - props.collapsedCount))
</script>
