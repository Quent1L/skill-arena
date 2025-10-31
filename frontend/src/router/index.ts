/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import TournamentsList from '@/views/TournamentsList.vue'
import TournamentDetailView from '@/views/TournamentDetailView.vue'
import AdminTournaments from '@/views/AdminTournaments.vue'
import { requireAdmin } from './guards'

declare module 'vue-router' {
  interface RouteMeta {
    breadcrumb?: string
    title?: string
    hideBreadcrumb?: boolean
    parent?: string
    requiresAuth?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      breadcrumb: 'Accueil',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/tournaments',
    name: 'tournaments',
    component: TournamentsList,
    meta: {
      breadcrumb: 'Tournois',
      title: 'Tournois',
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/tournaments/:id',
    name: 'tournament-detail',
    component: TournamentDetailView,
    meta: {
      breadcrumb: 'Détail du tournoi',
      title: 'Détail du tournoi',
      parent: 'tournaments',
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      breadcrumb: 'Connexion',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: {
      breadcrumb: 'Inscription',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/admin/tournaments',
    name: 'admin-tournaments',
    component: AdminTournaments,
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Administration',
      title: 'Administration des tournois',
      requiresAuth: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard pour protéger les routes
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth) {
    // Vérifier la session avec Better Auth
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/get-session`, {
        credentials: 'include',
      })
      const session = await response.json()
      const isAuthenticated = !!session?.user

      if (!isAuthenticated) {
        // Rediriger vers la page de connexion avec le chemin de redirection
        next({
          name: 'login',
          query: { redirect: to.fullPath },
        })
        return
      }
    } catch {
      // En cas d'erreur, rediriger vers login
      next({
        name: 'login',
        query: { redirect: to.fullPath },
      })
      return
    }
  }

  // Si l'utilisateur est authentifié et essaie d'accéder à login/register
  if (to.name === 'login' || to.name === 'register') {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/get-session`, {
        credentials: 'include',
      })
      const session = await response.json()
      const isAuthenticated = !!session?.user

      if (isAuthenticated) {
        next({ name: 'tournaments' })
        return
      }
    } catch {
      // En cas d'erreur, continuer vers login/register
    }
  }

  next()
})

export default router
