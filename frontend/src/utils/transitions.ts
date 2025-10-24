import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// Hiérarchie des routes pour déterminer la direction
const routeHierarchy: Record<string, number> = {
  home: 0,
  quiz: 1,
  'quiz-classic': 2,
  'quiz-ranking': 2,
  rankings: 1,
  stats: 1,
  profile: 1,
}

export function usePageTransitions() {
  const route = useRoute()

  const transitionName = ref('fade')
  const isNavigatingBack = ref(false)

  // Historique de navigation pour détecter les retours
  const navigationHistory = ref<string[]>([])

  watch(
    () => route.name,
    (newRouteName, oldRouteName) => {
      if (!newRouteName || !oldRouteName) {
        transitionName.value = 'fade'
        return
      }

      const newRouteString = newRouteName.toString()
      const oldRouteString = oldRouteName.toString()

      // Ajouter à l'historique
      if (!navigationHistory.value.includes(newRouteString)) {
        navigationHistory.value.push(newRouteString)
      }

      // Déterminer si c'est un retour en arrière
      const newLevel = routeHierarchy[newRouteString] ?? 1
      const oldLevel = routeHierarchy[oldRouteString] ?? 1

      isNavigatingBack.value =
        newLevel < oldLevel ||
        (newLevel === oldLevel &&
          navigationHistory.value.indexOf(newRouteString) <
            navigationHistory.value.indexOf(oldRouteString))

      // Choisir la transition appropriée
      transitionName.value = getTransitionForRoute(
        newRouteString,
        oldRouteString,
        isNavigatingBack.value,
      )
    },
    { immediate: true },
  )

  function getTransitionForRoute(newRoute: string, oldRoute: string, isBack: boolean): string {
    // Transitions spéciales selon le type de navigation

    // Navigation vers les quiz
    if (newRoute.includes('quiz') && !oldRoute.includes('quiz')) {
      return isBack ? 'slide-right' : 'slide-left'
    }

    // Navigation entre quiz
    if (newRoute.includes('quiz') && oldRoute.includes('quiz')) {
      return isBack ? 'slide-right' : 'slide-down'
    }

    // Navigation vers le profil
    if (newRoute === 'profile') {
      return 'slide-up'
    }

    // Navigation vers les stats
    if (newRoute === 'stats') {
      return 'zoom'
    }

    // Navigation vers les classements
    if (newRoute === 'rankings') {
      return isBack ? 'slide-right' : 'slide-left'
    }

    // Retour à l'accueil
    if (newRoute === 'home') {
      return isBack ? 'fade' : 'zoom-out'
    }

    // Transition par défaut
    return isBack ? 'slide-right' : 'fade'
  }

  return {
    transitionName,
    isNavigatingBack,
  }
}
