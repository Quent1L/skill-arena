<template>
  <div id="app" class="min-h-screen bg-primary">
    <RouterView v-slot="{ Component, route }">
      <Transition :name="transitionName" mode="out-in" appear>
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { usePageTransitions } from '@/utils/transitions'

// Utiliser notre système de transitions
const { transitionName } = usePageTransitions()
</script>

<style>
/* Transitions de base */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Transition glissement horizontal (vers la droite) */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Transition glissement horizontal (vers la gauche - retour) */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Transition glissement vertical (vers le haut) */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* Transition glissement vertical (vers le bas) */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Transition zoom (agrandissement) */
.zoom-enter-active,
.zoom-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.zoom-enter-from {
  transform: scale(0.85);
  opacity: 0;
}

.zoom-leave-to {
  transform: scale(1.15);
  opacity: 0;
}

/* Transition zoom out (rétrécissement) */
.zoom-out-enter-active,
.zoom-out-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.zoom-out-enter-from {
  transform: scale(1.15);
  opacity: 0;
}

.zoom-out-leave-to {
  transform: scale(0.85);
  opacity: 0;
}

/* Transition rotation (pour des effets spéciaux) */
.rotate-enter-active,
.rotate-leave-active {
  transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.rotate-enter-from {
  transform: rotate(-10deg) scale(0.9);
  opacity: 0;
}

.rotate-leave-to {
  transform: rotate(10deg) scale(0.9);
  opacity: 0;
}

/* Effet de fondu avec blur */
.blur-enter-active,
.blur-leave-active {
  transition: all 0.4s ease;
}

.blur-enter-from,
.blur-leave-to {
  opacity: 0;
  filter: blur(10px);
  transform: scale(1.05);
}

/* Positionnement pour éviter les problèmes de layout */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active,
.slide-up-enter-active,
.slide-up-leave-active,
.slide-down-enter-active,
.slide-down-leave-active {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  min-height: 100vh;
}

/* Container pour éviter les problèmes de positionnement */
#app {
  position: relative;
  overflow-x: hidden;
}

/* Amélioration des performances */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active,
.slide-up-enter-active,
.slide-up-leave-active,
.slide-down-enter-active,
.slide-down-leave-active,
.zoom-enter-active,
.zoom-leave-active,
.zoom-out-enter-active,
.zoom-out-leave-active,
.fade-enter-active,
.fade-leave-active {
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* Responsive: réduire les animations sur mobile pour de meilleures performances */
@media (max-width: 768px) {
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active,
  .slide-down-enter-active,
  .slide-down-leave-active {
    transition-duration: 0.3s;
  }
}

/* Réduire les animations si l'utilisateur préfère moins de mouvement */
@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active,
  .slide-down-enter-active,
  .slide-down-leave-active,
  .zoom-enter-active,
  .zoom-leave-active,
  .zoom-out-enter-active,
  .zoom-out-leave-active {
    transition-duration: 0.1s;
    transform: none !important;
  }
}
</style>
