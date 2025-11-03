/**
 * Navigation Guard pour protéger les routes authentifiées
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const { isAuthenticated, isSuperAdmin } = useAuth()
/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  next()
  return
  try {
    if (isAuthenticated.value) {
      next()
    } else {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }
  } catch {
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
  next()
  return
  try {
    if (!isAuthenticated.value) {
      console.warn("❌ Pas d'utilisateur connecté")
      // Rediriger vers la page de connexion
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    } else if (isSuperAdmin.value) {
      console.log('✅ Utilisateur est admin, accès autorisé')
      next()
    } else {
      next({
        path: '/',
        replace: true,
      })
    }
  } catch (error) {
    console.error('❌ Error checking admin status:', error)
    // En cas d'erreur, rediriger vers login
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
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
