<template>
  <header class="shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center cursor-pointer" @click="router.push('/')">
          <img src="@/assets/img/skill-arena-logo.png" alt="Skill Arena Logo" class="w-20 mr-2" />
          <h1 class="text-2xl font-bold">Skill Arena</h1>
        </div>

        <div class="flex items-center gap-3">
          <Button
            text
            rounded
            @click="toggleDarkMode"
            aria-label="Toggle dark mode"
            class="text-gray-600"
          >
            <i class="fas fa-moon"></i>
          </Button>

          <div v-if="!isAuthenticated" class="flex items-center gap-3">
            <Button label="Se connecter" text @click="router.push('/login')" />
            <Button label="S'inscrire" @click="router.push('/register')" class="text-sm" />
          </div>

          <div v-else class="flex items-center gap-3">
            <Menu ref="menu" :model="menuItems" :popup="true">
              <template #start>
                <div class="px-4 py-3 border-b border-gray-200">
                  <p class="text-sm font-medium">
                    {{ currentUser?.name || currentUser?.username }}
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">{{ currentUser?.email }}</p>
                </div>
              </template>
              <template #itemicon="{ item }">
                <i :class="item.icon"></i>
              </template>
            </Menu>

            <Button
              text
              rounded
              @click="toggleMenu"
              class="flex items-center gap-2"
              aria-label="Menu utilisateur"
            >
              <Avatar
                :label="currentUser ? getUserInitials(currentUser) : '?'"
                shape="circle"
                class="bg-blue-600 text-white"
              />
              <span class="hidden sm:block text-sm font-medium">
                {{ currentUser?.name || currentUser?.username }}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import type { User } from '@/types'
import type { MenuItem } from 'primevue/menuitem'

const router = useRouter()
const { currentUser, isAuthenticated, logout } = useAuth()
const menu = ref()

const menuItems = computed<MenuItem[]>(() => [
  {
    label: 'Mon profil',
    icon: 'fas fa-user',
    command: () => {
      router.push('/profile')
    },
  },
  {
    label: 'Paramètres',
    icon: 'fas fa-cog',
    command: () => {
      router.push('/settings')
    },
  },
  {
    separator: true,
  },
  {
    label: 'Se déconnecter',
    icon: 'fas fa-right-from-bracket',
    command: () => {
      handleLogout()
    },
    class: 'text-red-600',
  },
])

function toggleMenu(event: Event) {
  menu.value.toggle(event)
}

function handleLogout() {
  logout()
  router.push('/login')
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('my-app-dark')
  const isDarkMode = document.documentElement.classList.contains('my-app-dark')
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
}

function getUserInitials(user: User): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }
  return user.email ? user.email.substring(0, 2).toUpperCase() : '??'
}
</script>
