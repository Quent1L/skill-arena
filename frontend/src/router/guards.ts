/**
 * Navigation Guards pour protéger les routes authentifiées
 */

import type { RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { isNetworkError } from '@/utils/HttpErrors'
import { errorService } from '@/composables/useErrorService.ts'

/**
 * Unreachable backend: we have NO information about the session, so redirecting to
 * /login would be a false logout. Send to /offline instead, leaving the session state
 * "unknown" to be retried on the next navigation.
 */
function offlineRedirect(to: RouteLocationNormalized) {
  return { name: 'offline', query: { redirect: to.fullPath } }
}

function loginRedirect(to: RouteLocationNormalized) {
  return { path: '/login', query: { redirect: to.fullPath } }
}

/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(to: RouteLocationNormalized) {
  const { isAuthenticated, isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }

    if (isAuthenticated.value) {
      return
    } else {
      return loginRedirect(to)
    }
  } catch (error) {
    console.error('❌ Error during authentication check:', error)

    if (error instanceof Error && error.cause === 'INVITATION_CODE_REQUIRED') {
      const hasCookieCode = document.cookie
        .split('; ')
        .some((row) => row.startsWith('invitation_code='))
      if (!hasCookieCode) {
        errorService.showError(error)
      }
      return '/submit-invitation'
    }

    if (isNetworkError(error)) {
      return offlineRedirect(to)
    }

    return loginRedirect(to)
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est administrateur
 */
export async function requireAdmin(to: RouteLocationNormalized) {
  const { isAuthenticated, isSuperAdmin, isInitialized, initialize } = useAuth()

  try {
    // Initialiser la session si ce n'est pas déjà fait
    if (!isInitialized.value) {
      await initialize()
    }

    if (!isAuthenticated.value) {
      console.warn("Pas d'utilisateur connecté")
      return loginRedirect(to)
    } else if (isSuperAdmin.value) {
      console.log('Utilisateur est admin, accès autorisé')
      return
    } else {
      console.warn('Utilisateur connecté mais pas admin')
      return {
        path: '/',
        replace: true,
      }
    }
  } catch (error) {
    console.error('Error checking admin status:', error)

    // On INVITATION_CODE_REQUIRED, redirect to /submit-invitation
    // (the application code is carried by `cause`, see ApiConfig.ts)
    if (error instanceof Error && error.cause === 'INVITATION_CODE_REQUIRED') {
      return '/submit-invitation'
    }

    if (isNetworkError(error)) {
      return offlineRedirect(to)
    }

    // Autres erreurs - rediriger vers login
    return loginRedirect(to)
  }
}

/**
 * Middleware pour protéger la page paramètres (bloque les kiosks verrouillés)
 */
export async function requireSettingsAccess(to: RouteLocationNormalized) {
  const { isAuthenticated, userRole, isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }

    if (!isAuthenticated.value) {
      return loginRedirect(to)
    }

    if (userRole.value === 'kiosk' && localStorage.getItem('kiosk_settings_locked') === 'true') {
      return { path: '/', replace: true }
    }

    return
  } catch (error) {
    console.error('Error checking settings access:', error)

    if (isNetworkError(error)) {
      return offlineRedirect(to)
    }

    return loginRedirect(to)
  }
}

/**
 * Middleware pour rediriger les utilisateurs déjà connectés
 */
export async function redirectIfAuthenticated(to: RouteLocationNormalized) {
  const { isAuthenticated, isInitialized, initialize } = useAuth()

  try {
    if (!isInitialized.value) {
      await initialize()
    }

    if (isAuthenticated.value) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
      return { path: redirect, replace: true }
    }
  } catch (error) {
    console.error('Error during redirect check:', error)

    // With no backend response we cannot claim the user is logged out:
    // showing /login would be misleading.
    if (isNetworkError(error)) {
      return offlineRedirect(to)
    }
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
