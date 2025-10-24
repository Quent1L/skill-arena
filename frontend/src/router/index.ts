/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'
import ProfileView from '@/views/ProfileView.vue'
import EmptyPage from '@/views/EmptyPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: EmptyPage,
    },
    {
      path: '/quiz',
      name: 'quiz',
      component: EmptyPage,
    },
    {
      path: '/rankings',
      name: 'rankings',
      component: EmptyPage,
    },
    {
      path: '/stats',
      name: 'stats',
      component: EmptyPage,
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
    },
  ],
})

export default router
