<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
    <h2
      class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-4 min-w-0"
    >
      <i :class="[icon, variantClasses.icon]" />
      <span class="truncate">{{ title }}</span>
      <InfoTooltip :text="tooltip" />
    </h2>
    <div>
      <StatLeaderRow
        v-for="entry in visibleEntries"
        :key="entry.playerId"
        :players="[
          { id: entry.playerId, displayName: entry.displayName, shortName: entry.shortName },
        ]"
        :value="String(entry.currentStreak)"
        :value-class="variantClasses.value"
        :sub-label="unitLabel"
        :bar-pct="barWidth(entry)"
        :bar-class="variantClasses.bar"
        :tournament-id="tournamentId"
      />
    </div>
    <button
      v-if="hiddenCount > 0"
      type="button"
      class="mt-3 w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      :aria-expanded="expanded"
      data-test="toggle-entries"
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
import InfoTooltip from '@/components/InfoTooltip.vue'
import StatLeaderRow from '@/components/stats/StatLeaderRow.vue'

export type StreakVariant = 'orange' | 'red' | 'blue'

/** Tailwind needs the class names spelled out, so each variant lists them in full. */
const VARIANTS: Record<StreakVariant, { icon: string; bar: string; value: string }> = {
  orange: {
    icon: 'text-orange-500',
    bar: 'bg-orange-500',
    value: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    icon: 'text-red-500',
    bar: 'bg-red-500',
    value: 'text-red-600 dark:text-red-400',
  },
  blue: {
    icon: 'text-blue-500',
    bar: 'bg-blue-500',
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
    /** Says what counts as a streak here — current run, or best of the tournament. */
    tooltip: string
    collapsedCount?: number
    tournamentId?: string | null
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

/** Streaks are not ranked, so the bar is the only thing showing how far ahead the top is. */
function barWidth(entry: WinStreakEntry): number {
  const best = props.entries[0]?.currentStreak ?? 0
  if (best <= 0) return 0
  return Math.round((entry.currentStreak / best) * 100)
}
</script>
