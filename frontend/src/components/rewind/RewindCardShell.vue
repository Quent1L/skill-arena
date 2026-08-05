<template>
  <div class="flex h-full w-full flex-col justify-center gap-6 px-6 py-8 text-white">
    <Transition name="rewind-fade" appear>
      <div v-if="visible" class="flex flex-col items-center gap-2 text-center">
        <span
          v-if="eyebrow"
          class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
          :class="eyebrowClass"
        >
          {{ eyebrow }}
        </span>
        <h2 class="text-balance text-2xl font-black leading-tight">{{ title }}</h2>
        <p v-if="subtitle" class="text-sm text-gray-400">{{ subtitle }}</p>
      </div>
    </Transition>

    <Transition name="rewind-rise" appear>
      <div v-if="visible" class="flex flex-col gap-4">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    subtitle?: string
    eyebrowClass?: string
  }>(),
  { eyebrowClass: 'bg-indigo-500/20 text-indigo-300' },
)

// A frame of delay lets the enter transitions play on every card change rather
// than only on the first mount.
const visible = ref(false)
onMounted(() => requestAnimationFrame(() => (visible.value = true)))
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
