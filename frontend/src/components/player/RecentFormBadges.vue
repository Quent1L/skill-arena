<template>
  <div class="flex items-center gap-1">
    <div class="flex items-center gap-0.5">
      <div
        v-for="(r, i) in results"
        :key="i"
        class="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0"
        :class="r === 'V' ? 'bg-green-600' : r === 'D' ? 'bg-red-600' : 'bg-gray-600'"
      >
        {{ letter(r) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

type Result = 'V' | 'D' | 'N'

defineProps<{
  /** Domain codes, not display letters: V/D/N stay stable across locales. */
  results: Array<Result>
}>()

const { t } = useI18n()

const KEYS: Record<Result, string> = {
  V: 'recentFormBadges.winsShort',
  D: 'recentFormBadges.lossesShort',
  N: 'recentFormBadges.drawsShort',
}

const letter = (result: Result) => t(KEYS[result])
</script>
