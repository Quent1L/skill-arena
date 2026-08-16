<template>
  <div class="brand-backdrop" aria-hidden="true">
    <div class="backdrop-glow" />
    <span
      v-for="(particle, index) in PARTICLES"
      :key="index"
      class="particle"
      :style="{
        left: `${particle.left}%`,
        width: `${particle.size}px`,
        height: `${particle.size}px`,
        opacity: particle.opacity,
        animationDuration: `${particle.duration}s`,
        animationDelay: `${particle.delay}s`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * The backdrop shared by every full-screen brand moment (boot, update). It used
 * to be copy-pasted between SplashLoader and UpdateOverlay, which meant the two
 * screens drifted apart every time one of them was touched.
 */

/**
 * Deliberately hand-picked rather than random: the drift has to stay watchable
 * for the two minutes an update on a slow connection can take, so the durations
 * are mutually prime enough that the field never visibly loops.
 */
const PARTICLES = [
  { left: 8, size: 3, duration: 9, delay: 0, opacity: 0.5 },
  { left: 18, size: 2, duration: 7, delay: 2.2, opacity: 0.3 },
  { left: 28, size: 4, duration: 11, delay: 0.8, opacity: 0.4 },
  { left: 40, size: 2, duration: 8, delay: 3.5, opacity: 0.35 },
  { left: 46, size: 2, duration: 10, delay: 6.3, opacity: 0.3 },
  { left: 52, size: 3, duration: 10, delay: 1.2, opacity: 0.45 },
  { left: 63, size: 2, duration: 7, delay: 4.1, opacity: 0.3 },
  { left: 73, size: 4, duration: 9, delay: 0.4, opacity: 0.4 },
  { left: 82, size: 2, duration: 12, delay: 2.8, opacity: 0.35 },
  { left: 91, size: 3, duration: 8, delay: 5, opacity: 0.4 },
]
</script>

<style scoped>
.brand-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* The black the app icons are cut out of, so the native PWA splash, the
     pre-mount screen and this one are the same surface. */
  background: #000006;
  pointer-events: none;
}

.backdrop-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 48%, rgba(124, 47, 233, 0.22) 0%, transparent 65%);
  animation: glow-breathe 4s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}

.particle {
  position: absolute;
  bottom: -8px;
  border-radius: 50%;
  background: #a95ef9;
  animation: float-up linear infinite;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scaleX(1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) scaleX(0.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop-glow,
  .particle {
    animation: none !important;
  }

  .particle {
    opacity: 0.25 !important;
  }
}
</style>
