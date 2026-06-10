<template>
  <div class="rounded-2xl bg-gray-800 px-4 py-3 flex items-center gap-3">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
      Forme récente
      <InfoTooltip text="Du plus ancien au plus récent" />
    </div>
    <RecentFormBadges :results="results" />
  </div>
</template>

<script setup lang="ts">
import RecentFormBadges from './RecentFormBadges.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'

defineProps<{
  results: Array<'V' | 'D' | 'N'>
}>()
</script>
