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
    path: '/signup',
    name: 'signup',
    component: () => import('@/views/SignupView.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Inscription',
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
    path: '/submit-invitation',
    name: 'submit-invitation',
    component: () => import('@/views/SubmitInvitationView.vue'),
    meta: {
      breadcrumb: "Code d'invitation",
      hideBreadcrumb: true,
    },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Mot de passe oublié',
      hideBreadcrumb: true,
    },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: {
      breadcrumb: 'Réinitialiser le mot de passe',
      hideBreadcrumb: true,
    },
  },

  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/AdminView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
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
      parent: 'admin',
    },
  },

  {
    path: '/admin/tournaments/new',
    name: 'admin-tournament-new',
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
    path: '/admin/disciplines',
    name: 'admin-disciplines',
    component: () => import('@/views/admin/DisciplineList.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Gestion des disciplines',
      title: 'Gestion des disciplines',
      requiresAuth: true,
      parent: 'admin',
    },
  },
  {
    path: '/admin/disciplines/:id',
    name: 'admin-discipline-edit',
    component: () => import('@/views/admin/DisciplineFormView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Modifier',
      title: 'Modifier la discipline',
      requiresAuth: true,
      parent: 'admin-disciplines',
    },
  },
  {
    path: '/admin/invitations',
    name: 'admin-invitations',
    component: () => import('@/views/admin/AdminInvitationsView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: "Codes d'invitation",
      title: "Gestion des codes d'invitation",
      requiresAuth: true,
      parent: 'admin',
    },
  },
  {
    path: '/admin/rules',
    name: 'admin-rules',
    component: () => import('@/views/admin/GameRulesList.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Règles du jeu',
      title: 'Gestion des règles du jeu',
      requiresAuth: true,
      parent: 'admin',
    },
  },
  {
    path: '/admin/rules/new',
    name: 'admin-rules-new',
    component: () => import('@/views/admin/GameRulesFormView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Nouveau règlement',
      title: 'Nouveau règlement',
      requiresAuth: true,
      parent: 'admin-rules',
    },
  },
  {
    path: '/admin/rules/:id/edit',
    name: 'admin-rules-edit',
    component: () => import('@/views/admin/GameRulesFormView.vue'),
    beforeEnter: requireAdmin,
    meta: {
      breadcrumb: 'Modifier le règlement',
      title: 'Modifier le règlement',
      requiresAuth: true,
      parent: 'admin-rules',
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
  {
    path: '/tournaments/:tournamentId/create-match',
    name: 'create-match',
    component: () => import('@/views/CreateMatchView.vue'),
    beforeEnter: requireAuth,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/matches/:id',
    name: 'match-detail',
    component: () => import('@/views/MatchDetailView.vue'),
    beforeEnter: requireAuth,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/players/:id',
    name: 'player-detail',
    component: () => import('@/views/PlayerDetailView.vue'),
    beforeEnter: requireAuth,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/tournaments/:id/rules',
    name: 'tournament-rules',
    component: () => import('@/views/TournamentRulesView.vue'),
    meta: {
      hideBreadcrumb: true,
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    beforeEnter: requireAuth,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/views/NotificationsView.vue'),
    beforeEnter: requireAuth,
    meta: {
      hideBreadcrumb: true,
      requiresAuth: true,
    },
  },
  {
    path: '/offline',
    name: 'offline',
    component: () => import('@/views/OfflineView.vue'),
    meta: { title: 'Hors ligne', hideBreadcrumb: true },
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

router.beforeEach((to) => {
  if (to.name === 'offline') return true
  if (!navigator.onLine) {
    return { name: 'offline', query: { redirect: to.fullPath } }
  }
})

export default router
