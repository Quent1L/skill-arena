<template>
  <header class="shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <RouterLink to="/" class="flex items-center cursor-pointer">
          <i v-if="showBackButton" class="fa fa-chevron-left text-lg mt-2 text-gray-400"></i>
          <SkolLogo height="50" width="150"></SkolLogo>
        </RouterLink>

        <div class="flex items-center gap-3">
          <div v-if="!isAuthenticated" class="flex items-center gap-3">
            <Button label="Se connecter" text @click="handleLoginTap" />
            <Button label="S'inscrire" @click="router.push('/signup')" class="text-sm" />
          </div>

          <div v-else class="flex items-center gap-3">
            <NotificationBell @toggle="toggleNotifications" />
            <NotificationDropdown ref="notifDropdown" />

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
              <template #end>
                <div class="w-full flex justify-center text-xs text-gray-500 h-7 pt-2">
                  Version {{ appVersion }}
                </div>
              </template>
            </Menu>

            <Button
              text
              rounded
              @click="toggleMenu"
              class="flex items-center gap-2"
              aria-label="Menu utilisateur"
            >
              <PlayerAvatar
                v-if="currentUser"
                :name="currentUser.name ?? currentUser.email ?? '?'"
                size="sm"
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
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useViewport } from '@/composables/useViewport'
import type { MenuItem } from 'primevue/menuitem'
import NotificationBell from './NotificationBell.vue'
import NotificationDropdown from './NotificationDropdown.vue'
import SkolLogo from './SkolLogo.vue'
import PlayerAvatar from './PlayerAvatar.vue'

const appVersion = __APP_VERSION__

const route = useRoute()
const router = useRouter()
const { currentUser, appUser, isAuthenticated, logout, kioskSettingsLocked } = useAuth()
const { isMobile } = useViewport()
const showBackButton = computed(() =>
  isMobile.value && (route.name === 'tournament-detail' || route.name === 'tournament-tab')
)
const menu = ref()
const notifDropdown = useTemplateRef('notifDropdown')

const menuItems = computed<MenuItem[]>(() => [
  {
    label: 'Mes stats',
    icon: 'fas fa-chart-bar',
    command: () => {
      router.push(`/players/${appUser.value?.id}`)
    },
    visible: appUser.value?.role !== 'kiosk',
  },
  {
    label: 'Comparer des joueurs',
    icon: 'fas fa-people-arrows',
    command: () => {
      router.push({ name: 'player-compare' })
    },
    visible: appUser.value?.role !== 'kiosk',
  },
  {
    label: 'Paramètres',
    icon: 'fas fa-cog',
    command: () => {
      router.push('/settings')
    },
    visible: !(appUser.value?.role === 'kiosk' && kioskSettingsLocked.value),
  },
  {
    separator: true,
    visible: !(appUser.value?.role === 'kiosk' && kioskSettingsLocked.value),
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

let loginTapCount = 0
let loginTapTimer: ReturnType<typeof setTimeout> | null = null

function handleLoginTap() {
  loginTapCount++
  if (loginTapTimer) clearTimeout(loginTapTimer)
  loginTapTimer = setTimeout(() => { loginTapCount = 0 }, 3000)

  if (loginTapCount >= 5) {
    loginTapCount = 0
    if (loginTapTimer) clearTimeout(loginTapTimer)
    router.push('/login?native=true')
    return
  }

  router.push('/login')
}

function toggleMenu(event: Event) {
  menu.value.toggle(event)
}

function handleLogout() {
  logout()
  router.push('/login')
}

function toggleNotifications(event: Event) {
  notifDropdown.value?.toggle(event)
}

</script>
