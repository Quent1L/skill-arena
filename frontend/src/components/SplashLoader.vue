<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-overlay">
      <BrandBackdrop />
      <div class="splash-content">
        <SkolLogo />
        <!-- Echoes the two traits that flank ARENA in the lockup, so the wait
             indicator reads as part of the logo rather than bolted under it. -->
        <div class="splash-track">
          <span class="splash-seg splash-seg-left" />
          <span class="splash-seg splash-seg-right" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import SkolLogo from '@/components/brand/SkolLogo.vue'
import BrandBackdrop from '@/components/brand/BrandBackdrop.vue'

defineProps<{ visible: boolean }>()
</script>

<style scoped>
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000006;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.splash-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 34px;
}

/* Let the lockup shrink on narrow screens instead of overflowing: the viewBox
   handles the ratio, so only the width needs saying. */
.splash-content :deep(.skol-svg) {
  width: min(360px, 78vw);
  height: auto;
}

.splash-track {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(240px, 60vw);
  height: 3px;
}

/* Once open, the pair breathes rather than marching: there is no progress to
   report at boot, so a determinate-looking bar would be a lie. */
.splash-seg {
  height: 100%;
  flex: 1;
  border-radius: 2px;
  transform: scaleX(0);
  animation:
    seg-grow 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.75s forwards,
    seg-breathe 1.9s ease-in-out 1.2s infinite;
}

.splash-seg-left {
  transform-origin: right center;
  background: linear-gradient(90deg, rgba(26, 18, 70, 0.1), #904ae4 70%, #e467ff);
}

.splash-seg-right {
  transform-origin: left center;
  background: linear-gradient(90deg, #9a57ed, #6f2aba 60%, rgba(28, 18, 66, 0.1));
}

@keyframes seg-grow {
  to {
    transform: scaleX(1);
  }
}

@keyframes seg-breathe {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.splash-fade-leave-active {
  transition: opacity 0.4s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .splash-seg {
    animation: none !important;
    transform: scaleX(1);
    opacity: 0.7;
  }
}
</style>
