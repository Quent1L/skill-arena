/**
 * Navigation Guards pour protéger les routes authentifiées
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorService } from '@/composables/useErrorService.ts'

/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const { isAuthenticated, isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }

    if (isAuthenticated.value) {
      next()
    } else {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }
  } catch (error) {
    console.error('❌ Error during authentication check:', error)

    if (error instanceof Error && error.cause === 'INVITATION_CODE_REQUIRED') {
      const hasCookieCode = document.cookie
        .split('; ')
        .some(row => row.startsWith('invitation_code='))
      if (!hasCookieCode) {
        errorService.showError(error)
      }
      next('/submit-invitation')
      return
    }

    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est administrateur
 */
export async function requireAdmin(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const { isAuthenticated, isSuperAdmin, isInitialized, initialize } = useAuth()

  try {
    // Initialiser la session si ce n'est pas déjà fait
    if (!isInitialized.value) {
      await initialize()
    }

    if (!isAuthenticated.value) {
      console.warn("❌ Pas d'utilisateur connecté")
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    } else if (isSuperAdmin.value) {
      console.log('✅ Utilisateur est admin, accès autorisé')
      next()
    } else {
      console.warn('❌ Utilisateur connecté mais pas admin')
      next({
        path: '/',
        replace: true,
      })
    }
  } catch (error) {
    console.error('❌ Error checking admin status:', error)

    // Si l'erreur est INVITATION_CODE_REQUIRED, rediriger vers /submit-invitation
    if (error instanceof Error && error.message === 'INVITATION_CODE_REQUIRED') {
      next('/submit-invitation')
      return
    }

    // Autres erreurs - rediriger vers login
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
}

/**
 * Middleware pour rediriger les utilisateurs déjà connectés
 */
export async function redirectIfAuthenticated(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const { isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }
    next()
  } catch (error) {
    console.error('❌ Error during redirect check:', error)
    next()
  }
}

/**
 * Exemple d'utilisation dans le router:
 *
 * {
 *   path: '/dashboard',
 *   component: DashboardView,
 *   beforeEnter: requireAuth
 * }
 *
 * {
 *   path: '/admin',
 *   component: AdminView,
 *   beforeEnter: requireAdmin
 * }
 */
