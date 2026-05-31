<template>
  <div class="rounded-2xl bg-gray-800 px-4 py-3 flex items-center gap-3">
    <div class="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center">
      Forme récente
      <Button
        text
        icon="fas fa-circle-info"
        size="small"
        severity="secondary"
        rounded
        @click="popover?.toggle($event)"
        @mouseenter="popover?.show($event)"
        @mouseleave="popover?.hide()"
      />
    </div>
    <RecentFormBadges :results="results" />
    <Popover ref="popover">
      <span class="text-xs">Du plus ancien au plus récent</span>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import Popover from 'primevue/popover'
import RecentFormBadges from './RecentFormBadges.vue'

defineProps<{
  results: Array<'V' | 'D' | 'N'>
}>()

const popover = useTemplateRef<InstanceType<typeof Popover>>('popover')
</script>
