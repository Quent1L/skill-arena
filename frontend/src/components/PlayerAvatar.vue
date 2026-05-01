<template>
  <div
    class="flex items-center justify-center font-bold uppercase text-white flex-shrink-0"
    :class="[sizeClass, shape === 'circle' ? 'rounded-full' : 'rounded-md border border-surface-900 ring-1 ring-surface-700/20']"
    :style="{ background: getAvatarBg(colorKey ?? name) }"
  >
    {{ getInitials(name) }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getInitials, getAvatarBg } from '@/utils/StringUtils'

const props = defineProps<{
  name: string
  colorKey?: string
  size?: 'xs' | 'sm' | 'md'
  shape?: 'square' | 'circle'
}>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'w-6 h-6 text-[10px]'
    case 'sm': return 'w-7 h-7 text-xs'
    default:   return 'w-9 h-9 text-sm'
  }
})
</script>
