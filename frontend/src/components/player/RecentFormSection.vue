<template>
  <div class="rounded-2xl bg-gray-800 px-4 py-3 flex items-center gap-3">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center">
      Forme récente
      <i
        v-tooltip.top="'Du plus ancien au plus récent'"
        class="ml-1 fas fa-circle-info text-[10px] text-gray-600 cursor-help shrink-0"
      />
    </div>
    <RecentFormBadges :results="results" />
  </div>
</template>

<script setup lang="ts">
import RecentFormBadges from './RecentFormBadges.vue'

defineProps<{
  results: Array<'V' | 'D' | 'N'>
}>()
</script>
