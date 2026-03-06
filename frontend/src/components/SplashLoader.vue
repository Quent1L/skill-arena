<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-overlay">
      <div class="splash-bg-glow" />
      <div class="splash-particles">
        <span v-for="n in 10" :key="n" class="particle" :class="`p${n}`" />
      </div>
      <div class="splash-content">
        <SkolLogo :animated="false" />
        <div class="splash-dots">
          <span class="d d1" />
          <span class="d d2" />
          <span class="d d3" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import SkolLogo from '@/components/SkolLogo.vue'

defineProps<{ visible: boolean }>()
</script>

<style scoped>
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0f0d1a;
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
  gap: 32px;
}

/* ===== GLOW CENTRAL ===== */
.splash-bg-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 48%, rgba(124, 58, 237, 0.18) 0%, transparent 65%);
  animation: glow-breathe 4s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%, 100% { transform: scale(1);    opacity: 0.7; }
  50%       { transform: scale(1.35); opacity: 1; }
}

/* ===== PARTICULES ===== */
.splash-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: #a78bfa;
  animation: float-up linear infinite;
  bottom: -8px;
}

@keyframes float-up {
  0%   { transform: translateY(0)      scaleX(1); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(-100vh) scaleX(0.6); opacity: 0; }
}

/* position / taille / durée / délai pour chaque particule */
.p1  { width: 3px;   height: 3px;   left:  8%;  animation-duration:  9s; animation-delay:  0s;   opacity: 0.5; }
.p2  { width: 2px;   height: 2px;   left: 18%;  animation-duration:  7s; animation-delay:  2.2s; opacity: 0.3; }
.p3  { width: 4px;   height: 4px;   left: 28%;  animation-duration: 11s; animation-delay:  0.8s; opacity: 0.4; }
.p4  { width: 2px;   height: 2px;   left: 40%;  animation-duration:  8s; animation-delay:  3.5s; opacity: 0.35; }
.p5  { width: 3px;   height: 3px;   left: 52%;  animation-duration: 10s; animation-delay:  1.2s; opacity: 0.45; }
.p6  { width: 2px;   height: 2px;   left: 63%;  animation-duration:  7s; animation-delay:  4.1s; opacity: 0.3; }
.p7  { width: 4px;   height: 4px;   left: 73%;  animation-duration:  9s; animation-delay:  0.4s; opacity: 0.4; }
.p8  { width: 2px;   height: 2px;   left: 82%;  animation-duration: 12s; animation-delay:  2.8s; opacity: 0.35; }
.p9  { width: 3px;   height: 3px;   left: 91%;  animation-duration:  8s; animation-delay:  5.0s; opacity: 0.4; }
.p10 { width: 2px;   height: 2px;   left: 46%;  animation-duration: 10s; animation-delay:  6.3s; opacity: 0.3; }

/* ===== POINTS DU BAS ===== */
.splash-dots {
  display: flex;
  gap: 10px;
}

.d {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a78bfa;
  animation: dot-bounce 1s ease-in-out infinite;
}

.d1 { animation-delay: 0s; }
.d2 { animation-delay: 0.18s; }
.d3 { animation-delay: 0.36s; }

@keyframes dot-bounce {
  0%, 100% { transform: translateY(0);    opacity: 0.5; }
  50%       { transform: translateY(-6px); opacity: 1; }
}

/* ===== TRANSITION ===== */
.splash-fade-leave-active { transition: opacity 0.4s ease; }
.splash-fade-leave-to     { opacity: 0; }
</style>
