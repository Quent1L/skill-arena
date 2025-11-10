/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import TournamentList from '@/views/admin/TournamentList.vue'
import TournamentFormView from '@/views/admin/TournamentFormView.vue'
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
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      breadcrumb: 'Accueil',
      hideBreadcrumb: true,
    },
  },

  {
    path: '/login',
    name: 'login',
    component: LoginView,
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Connexion',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Inscription',
      hideBreadcrumb: true,
    },
  },

  // Tournament Administration Routes
  {
    path: '/admin/tournaments',
    name: 'admin-tournaments',
    component: TournamentList,
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Gestion des tournois',
      title: 'Gestion des tournois',
      requiresAuth: true,
    },
  },
  {
    path: '/admin/tournaments/:id',
    name: 'admin-tournament-form',
    component: TournamentFormView,
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Tournoi',
      title: 'Nouveau tournoi',
      requiresAuth: true,
      parent: 'admin-tournaments',
    },
  },
  {
    path: '/admin/tournaments/:id/edit',
    name: 'admin-tournament-edit',
    component: TournamentFormView,
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Modifier',
      title: 'Modifier le tournoi',
      requiresAuth: true,
      parent: 'admin-tournaments',
    },
  },
  {
    path: '/tournaments',
    name: 'tournaments',
    component: () => import('@/views/HomeView.vue'),
    beforeEnter: requireAuth,
    meta: {
      breadcrumb: 'Tournois',
      title: 'Liste des tournois',
      requiresAuth: true,
    },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
