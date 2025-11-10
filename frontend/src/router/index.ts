/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { requireAdmin, requireAuth, redirectIfAuthenticated } from './guards'

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
    path: '/public',
    name: 'home',
    component: () => import('@/views/PublicHomeView.vue'),
    meta: {
      breadcrumb: 'Accueil',
      hideBreadcrumb: true,
    },
  },

  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Connexion',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Inscription',
      hideBreadcrumb: true,
    },
  },

  {
    path: '/admin/tournaments',
    name: 'admin-tournaments',
    component: () => import('@/views/admin/TournamentList.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Gestion des tournois',
      title: 'Gestion des tournois',
      requiresAuth: true,
    },
  },
  {
    path: '/admin/tournaments/:id/edit',
    name: 'admin-tournament-edit',
    component: () => import('@/views/admin/TournamentFormView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Modifier',
      title: 'Modifier le tournoi',
      requiresAuth: true,
      parent: 'admin-tournaments',
    },
  },
  {
    path: '/',
    name: 'tournaments',
    component: () => import('@/views/TournamentsView.vue'),
    beforeEnter: requireAuth,
    meta: {
      requiresAuth: true,
      hideBreadcrumb: true,
    },
  },
  {
    path: '/tournaments/:id',
    name: 'tournament-detail',
    component: () => import('@/views/TournamentDetailView.vue'),
    beforeEnter: requireAuth,
    meta: {
      breadcrumb: 'Détails du tournoi',
      title: 'Détails du tournoi',
      requiresAuth: true,
      parent: 'tournaments',
    },
  },
  /** all ERROR */
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: {
      hideBreadcrumb: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
