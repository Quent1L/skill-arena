<template>
  <span
    class="inline-flex items-center gap-1 text-[10px] leading-none text-amber-600 dark:text-amber-400/80 min-w-0"
    data-test="low-sample-badge"
  >
    <i class="fa fa-triangle-exclamation shrink-0" />
    <span class="truncate">{{
      t('tournamentStatsTab.lowSample', { count: MIN_WEIGHTED_RATE_MATCHES })
    }}</span>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MIN_WEIGHTED_RATE_MATCHES } from '@skol-arena/shared'

const { t } = useI18n()
</script>
