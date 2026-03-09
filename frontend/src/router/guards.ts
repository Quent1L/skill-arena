/**
 * Navigation Guards pour protéger les routes authentifiées
 */

import type { RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorService } from '@/composables/useErrorService.ts'

/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(
  to: RouteLocationNormalized,
) {
  const { isAuthenticated, isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }

    if (isAuthenticated.value) {
      return
    } else {
      return {
        path: '/login',
        query: { redirect: to.fullPath },
      }
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
      return '/submit-invitation'
    }

    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est administrateur
 */
export async function requireAdmin(
  to: RouteLocationNormalized,
) {
  const { isAuthenticated, isSuperAdmin, isInitialized, initialize } = useAuth()

  try {
    // Initialiser la session si ce n'est pas déjà fait
    if (!isInitialized.value) {
      await initialize()
    }

    if (!isAuthenticated.value) {
      console.warn("❌ Pas d'utilisateur connecté")
      return {
        path: '/login',
        query: { redirect: to.fullPath },
      }
    } else if (isSuperAdmin.value) {
      console.log('✅ Utilisateur est admin, accès autorisé')
      return
    } else {
      console.warn('❌ Utilisateur connecté mais pas admin')
      return {
        path: '/',
        replace: true,
      }
    }
  } catch (error) {
    console.error('❌ Error checking admin status:', error)

    // Si l'erreur est INVITATION_CODE_REQUIRED, rediriger vers /submit-invitation
    if (error instanceof Error && error.message === 'INVITATION_CODE_REQUIRED') {
      return '/submit-invitation'
    }

    // Autres erreurs - rediriger vers login
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }
}

/**
 * Middleware pour rediriger les utilisateurs déjà connectés
 */
export async function redirectIfAuthenticated(
) {
  const { isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }
  } catch (error) {
    console.error('❌ Error during redirect check:', error)
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
