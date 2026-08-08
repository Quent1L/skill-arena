<template>
  <div class="flex items-center gap-3">
    <div
      class="flex items-center justify-center rounded-2xl shadow-lg"
      :class="[iconBgClass, size === 'lg' ? 'h-14 w-14' : 'h-11 w-11']"
    >
      <i :class="[iconClass, size === 'lg' ? 'text-2xl' : 'text-lg']" class="text-white" />
    </div>
    <span
      class="font-black uppercase tracking-wide"
      :class="[textClass, size === 'lg' ? 'text-xl' : 'text-base']"
    >
      {{ tier.name }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RewindTierRef } from '@skol-arena/shared/types/index'
import {
  TIER_ICON_BG_CLASS,
  TIER_TEXT_CLASS,
  getTierIconClass,
  tierStyleIdx,
} from '@/composables/ranked/tier-style'

/**
 * The rank tier behind a rewind figure, drawn from the same icon and colour
 * tables as the live leaderboard so a season ends on the badge the player spent
 * it looking at.
 */
const props = withDefaults(defineProps<{ tier: RewindTierRef; size?: 'md' | 'lg' }>(), {
  size: 'md',
})

const styleIdx = computed(() => tierStyleIdx(props.tier))
const iconClass = computed(() => getTierIconClass(props.tier))
const iconBgClass = computed(() => TIER_ICON_BG_CLASS[styleIdx.value] ?? 'bg-gray-600')
const textClass = computed(() => TIER_TEXT_CLASS[styleIdx.value] ?? 'text-gray-400')
</script>
