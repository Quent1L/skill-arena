<template>
  <Transition name="rewind-hint">
    <div
      v-if="visible"
      class="pointer-events-none absolute right-[12.5%] top-[65%] z-20 -translate-y-1/2"
      aria-hidden="true"
    >
      <span class="hint-ripple absolute inset-0 rounded-full bg-white/10" />
      <span
        class="hint-dot relative block h-14 w-14 rounded-full bg-white/[0.06] ring-1 ring-white/20"
      />
      <span
        class="hint-label absolute right-0 top-full mt-2 w-max max-w-[9rem] text-right text-xs font-medium text-white/70"
      >
        {{ t('rewind.overlay.tapHint') }}
      </span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * A ghost tap on the deck's forward zone: a translucent disc that pulses like a
 * finger landing on the screen. Purely decorative — `pointer-events-none` keeps
 * the tap zone underneath it fully clickable.
 */
defineProps<{ visible: boolean }>()

const { t } = useI18n()
</script>

<style scoped>
.hint-dot {
  animation: hint-press 2.2s ease-in-out infinite;
}

.hint-ripple {
  animation: hint-ripple 2.2s ease-out infinite;
}

@keyframes hint-press {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.45;
  }
  20% {
    transform: scale(0.86);
    opacity: 0.7;
  }
}

@keyframes hint-ripple {
  0% {
    transform: scale(0.9);
    opacity: 0.3;
  }
  60%,
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.rewind-hint-enter-active,
.rewind-hint-leave-active {
  transition: opacity 0.35s ease-out;
}
.rewind-hint-enter-from,
.rewind-hint-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .hint-dot,
  .hint-ripple {
    animation: none;
  }
  .hint-ripple {
    opacity: 0;
  }
}
</style>
