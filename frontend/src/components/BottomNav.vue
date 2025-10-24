<template>
  <nav class="nav-item fixed bottom-0 left-0 right-0 z-50">
    <div class="grid grid-cols-4 max-w-lg mx-auto">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="nav-link flex flex-col items-center justify-center py-3 px-2 text-xs font-medium transition-all duration-300 relative overflow-hidden"
        :class="[
          $route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/')
            ? 'nav-item-active'
            : 'nav-item-inactive hover:text-primary',
        ]"
        @click="handleNavClick(item.name)"
      >
        <!-- Indicateur d'animation au clic -->
        <div class="nav-ripple absolute inset-0 pointer-events-none"></div>

        <!-- Indicateur de page active -->
        <div
          v-if="$route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/')"
          class="active-indicator absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-green-500 rounded-full"
        ></div>

        <div class="nav-icon-container relative">
          <component
            :is="item.icon"
            class="nav-icon w-5 h-5 mb-1 transition-all duration-300"
            :class="[
              $route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/')
                ? 'text-green-600 scale-110'
                : 'text-muted scale-100',
            ]"
          />

          <!-- Badge de notification (exemple pour les stats) -->
          <div
            v-if="item.name === 'stats' && hasNewStats"
            class="notification-badge absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"
          ></div>
        </div>

        <span
          class="nav-label transition-all duration-300"
          :class="[
            $route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/')
              ? 'text-green-600 font-semibold transform scale-105'
              : 'text-muted',
          ]"
        >
          {{ item.label }}
        </span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { PuzzlePieceIcon, TrophyIcon, ChartBarIcon, UserIcon } from '@heroicons/vue/24/outline'

// État pour les notifications
const hasNewStats = ref(false)

const navItems = [
  {
    name: 'quiz',
    label: 'Quiz',
    to: '/quiz',
    icon: PuzzlePieceIcon,
  },
  {
    name: 'rankings',
    label: 'Classements',
    to: '/rankings',
    icon: TrophyIcon,
  },
  {
    name: 'stats',
    label: 'Stats',
    to: '/stats',
    icon: ChartBarIcon,
  },
  {
    name: 'profile',
    label: 'Profil',
    to: '/profile',
    icon: UserIcon,
  },
]

// Animation au clic
const handleNavClick = (itemName: string) => {
  // Animation de ripple effect
  const event = new CustomEvent('nav-click', { detail: { item: itemName } })
  window.dispatchEvent(event)

  // Vibration haptique sur mobile
  if ('vibrate' in navigator) {
    navigator.vibrate(50)
  }
}
</script>

<style scoped>
/* Animation de l'indicateur actif */
.active-indicator {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    width: 0;
    opacity: 0;
  }
  to {
    width: 2rem;
    opacity: 1;
  }
}

/* Effet de hover pour les liens non-actifs */
.nav-link:not(.nav-item-active):hover .nav-icon {
  transform: translateY(-2px) scale(1.05);
}

.nav-link:not(.nav-item-active):hover .nav-label {
  transform: translateY(-1px);
}

/* Animation de bounce subtile pour l'icône active */
.nav-item-active .nav-icon {
  animation: gentleBounce 0.6s ease-out;
}

@keyframes gentleBounce {
  0%,
  100% {
    transform: scale(1.1);
  }
  50% {
    transform: scale(1.2);
  }
}

/* Effet ripple au clic */
.nav-link:active .nav-ripple {
  background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%);
  animation: ripple 0.4s ease-out;
}

@keyframes ripple {
  from {
    transform: scale(0);
    opacity: 1;
  }
  to {
    transform: scale(1);
    opacity: 0;
  }
}

/* Badge de notification qui pulse */
.notification-badge {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

/* Amélioration des transitions pour un feeling premium */
.nav-icon-container {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.nav-label {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* États de focus pour l'accessibilité */
.nav-link:focus {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
}

.nav-link:focus .nav-icon {
  transform: scale(1.1);
}

/* Animation d'entrée pour la navigation */
.nav-item {
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Réduire les animations sur mobile pour les performances */
@media (max-width: 768px) {
  .nav-link,
  .nav-icon,
  .nav-label,
  .nav-icon-container {
    transition-duration: 0.2s;
  }
}

/* Respect des préférences d'accessibilité */
@media (prefers-reduced-motion: reduce) {
  .nav-link,
  .nav-icon,
  .nav-label,
  .nav-icon-container,
  .active-indicator,
  .notification-badge {
    animation: none;
    transition: none;
  }
}
</style>
