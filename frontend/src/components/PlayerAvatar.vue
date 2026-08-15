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
import { avatarSizeClass, type AvatarSize } from '@/components/avatar-size'

const props = defineProps<{
  name: string
  colorKey?: string
  size?: AvatarSize
  shape?: 'square' | 'circle'
}>()

const sizeClass = computed(() => avatarSizeClass(props.size))
</script>
