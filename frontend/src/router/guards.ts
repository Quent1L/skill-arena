/**
 * Navigation Guard pour protéger les routes authentifiées
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { authClient } from '@/lib/auth-client'
import type { User } from '@skill-arena/shared'

/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  try {
    const session = await authClient.getSession()

    if (session.data?.user) {
      next()
    } else {
      // Rediriger vers la page de connexion
      next({
        path: '/auth',
        query: { redirect: to.fullPath },
      })
    }
  } catch {
    // En cas d'erreur, rediriger vers login
    next({
      path: '/auth',
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
  try {
    const session = await authClient.getSession()

    console.log('🔍 Session complète:', session)
    console.log('🔍 Session data:', session.data)
    console.log('🔍 User:', session.data?.user)

    const user = session.data?.user as User | undefined

    if (!user) {
      console.warn("❌ Pas d'utilisateur connecté")
      // Rediriger vers la page de connexion
      next({
        path: '/auth',
        query: { redirect: to.fullPath },
      })
    } else if (user.isAdmin) {
      console.log('✅ Utilisateur est admin, accès autorisé')
      next()
    } else {
      // L'utilisateur est connecté mais n'est pas admin
      console.warn('⚠️ User is not admin:', user.email, 'isAdmin:', user.isAdmin)
      next({
        path: '/',
        replace: true,
      })
    }
  } catch (error) {
    console.error('❌ Error checking admin status:', error)
    // En cas d'erreur, rediriger vers login
    next({
      path: '/auth',
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
