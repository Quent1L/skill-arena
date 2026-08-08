<template>
  <!-- Heights are deliberately frugal: a story card the player has to scroll is a
       card they will not read. Everything here shrinks again below 720 px of
       viewport height, where the deck is at its tightest. -->
  <div
    class="flex h-full w-full flex-col justify-center gap-4 px-5 py-5 text-white [@media(max-height:720px)]:gap-3 [@media(max-height:720px)]:py-3"
  >
    <Transition name="rewind-fade" appear>
      <div class="flex flex-col items-center gap-1.5 text-center">
        <span
          v-if="eyebrow"
          class="rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-widest"
          :class="eyebrowClass"
        >
          {{ eyebrow }}
        </span>
        <h2 class="text-balance text-xl font-black leading-tight">{{ title }}</h2>
        <p v-if="subtitle" class="text-sm text-gray-300">{{ subtitle }}</p>
      </div>
    </Transition>

    <Transition name="rewind-rise" appear>
      <div class="flex flex-col gap-2.5">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * `appear` is what plays the entrance, and the slot is rendered from the very
 * first frame on purpose. Gating it behind a flag flipped one frame after mount
 * — the previous approach — meant every card's content entered the DOM already
 * in its final state, so the count-ups' and bars' own transitions had nothing
 * left to animate from. The deck remounts a card on every move (`:key`), so a
 * plain `appear` replays the entrance just the same.
 */
withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    eyebrowClass?: string
  }>(),
  { eyebrowClass: 'bg-indigo-500/20 text-indigo-300' },
)
</script>

<style scoped>
.rewind-fade-enter-active {
  transition:
    opacity 0.45s ease-out,
    transform 0.45s ease-out;
}
.rewind-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.rewind-rise-enter-active {
  transition:
    opacity 0.5s ease-out 0.12s,
    transform 0.5s ease-out 0.12s;
}
.rewind-rise-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .rewind-fade-enter-active,
  .rewind-rise-enter-active {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }
}
</style>
