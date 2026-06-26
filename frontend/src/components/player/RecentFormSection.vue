<template>
  <div class="rounded-2xl bg-gray-800 px-4 py-3 flex items-center gap-3">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
      {{ t('recentFormSection.title') }}
      <InfoTooltip :text="t('recentFormSection.tooltip')" />
    </div>
    <RecentFormBadges :results="results" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RecentFormBadges from './RecentFormBadges.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'

defineProps<{
  results: Array<'V' | 'D' | 'N'>
}>()

const { t } = useI18n()
</script>
