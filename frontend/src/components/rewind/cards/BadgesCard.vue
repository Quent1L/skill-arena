<template>
  <RewindCardShell
    :eyebrow="t('rewind.badges.eyebrow')"
    eyebrow-class="bg-amber-500/20 text-amber-300"
    :title="t('rewind.badges.title', player.badges.length)"
  >
    <div class="grid grid-cols-2 gap-3">
      <TransitionGroup name="badge-pop" appear>
        <div
          v-for="(badge, index) in player.badges"
          :key="badge.id"
          class="flex flex-col items-center gap-2 rounded-2xl bg-white/5 px-3 py-4 text-center"
          :style="{ transitionDelay: `${index * 90}ms` }"
        >
          <i :class="badge.icon || 'fa fa-medal'" class="text-3xl text-amber-400" />
          <span class="text-sm font-semibold leading-tight">{{ badge.label }}</span>
          <span class="text-[11px] leading-tight text-gray-500">{{ badge.description }}</span>
        </div>
      </TransitionGroup>
    </div>
  </RewindCardShell>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PlayerRewindPayload } from '@skol-arena/shared/types/index'
import RewindCardShell from '../RewindCardShell.vue'

defineProps<{ player: PlayerRewindPayload }>()

const { t } = useI18n()
</script>

<style scoped>
.badge-pop-enter-active {
  transition:
    opacity 0.4s ease-out,
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.badge-pop-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .badge-pop-enter-active {
    transition-duration: 0.01ms;
    transition-delay: 0ms !important;
  }
}
</style>
