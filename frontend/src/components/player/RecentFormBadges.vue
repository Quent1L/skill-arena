<template>
  <div class="flex items-center gap-1">
    <div class="flex items-center gap-0.5">
      <div
        v-for="(r, i) in results"
        :key="i"
        class="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0"
        :class="r === 'V' ? 'bg-green-600' : r === 'D' ? 'bg-red-600' : 'bg-gray-600'"
      >
        {{ r }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  results: Array<'V' | 'D' | 'N'>
}>();
</script>
