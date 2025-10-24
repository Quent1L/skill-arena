<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="bg-surface border-b border-border">
      <div class="px-6 py-4">
        <h1 class="text-2xl font-bold text-primary">Mon Profil</h1>
        <p class="text-secondary">Gérez votre compte et préférences</p>
      </div>
    </div>

    <div class="px-6 py-8 space-y-6">
      <!-- Profil utilisateur -->
      <div class="card text-center">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center">
          <span class="text-2xl text-white">{{ userInitials }}</span>
        </div>
        <h2 class="text-xl font-semibold text-primary mb-1">{{ profile.username }}</h2>
        <p class="text-secondary mb-4">Membre depuis {{ memberSince }}</p>

        <button @click="editProfile = !editProfile" class="btn-primary px-4 py-2 font-medium">
          {{ editProfile ? 'Annuler' : 'Modifier le profil' }}
        </button>
      </div>
      <!-- Édition du profil -->
      <div v-if="editProfile" class="card">
        <h3 class="text-lg font-semibold text-primary mb-4">Modifier le profil</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1">Nom d'utilisateur</label>
            <input
              v-model="editedProfile.username"
              type="text"
              class="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-primary"
            />
          </div>
          <div class="flex space-x-3">
            <button @click="saveProfile" class="flex-1 btn-primary py-2 font-medium">
              Sauvegarder
            </button>
            <button @click="cancelEdit" class="btn-secondary flex-1">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Résumé des stats -->
      <div class="card">
        <h3 class="text-lg font-semibold text-primary mb-4">🏆 Vos performances</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center p-3 bg-accent rounded-lg">
            <div class="text-xl font-bold text-green-600">{{ profile.stats.totalQuizzes }}</div>
            <div class="text-sm text-secondary">Quiz joués</div>
          </div>
          <div class="text-center p-3 bg-accent rounded-lg">
            <div class="text-xl font-bold text-green-600">{{ profile.stats.averageScore }}%</div>
            <div class="text-sm text-secondary">Score moyen</div>
          </div>
        </div>
      </div>
      <!-- Préférences -->
      <div class="card">
        <h3 class="text-lg font-semibold text-primary mb-4">⚙️ Préférences</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-primary">Thème sombre</div>
              <div class="text-sm text-secondary">Interface en mode sombre</div>
            </div>
            <button
              @click="toggleTheme"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="
                profile.preferences.theme === 'dark'
                  ? 'bg-green-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              "
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="profile.preferences.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-primary">Sons activés</div>
              <div class="text-sm text-secondary">Effets sonores du jeu</div>
            </div>
            <button
              @click="toggleSound"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="
                profile.preferences.soundEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
              "
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="profile.preferences.soundEnabled ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </button>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-primary">Temps limité</div>
              <div class="text-sm text-secondary">Activer le chronomètre</div>
            </div>
            <button
              @click="toggleTimeLimit"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="
                profile.preferences.timeLimit ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
              "
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="profile.preferences.timeLimit ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-primary">Notifications</div>
              <div class="text-sm text-secondary">Rappels et nouveautés</div>
            </div>
            <button
              @click="toggleNotifications"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="
                profile.preferences.notifications ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
              "
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="profile.preferences.notifications ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </button>
          </div>
        </div>
      </div>
      <!-- Actions -->
      <div class="card">
        <h3 class="text-lg font-semibold text-primary mb-4">📱 Application</h3>
        <div class="space-y-3">
          <button class="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors">
            <div class="font-medium text-primary">📊 Exporter mes données</div>
            <div class="text-sm text-secondary">Télécharger vos statistiques</div>
          </button>
          <button class="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors">
            <div class="font-medium text-primary">🔄 Réinitialiser les stats</div>
            <div class="text-sm text-secondary">Remettre à zéro vos performances</div>
          </button>

          <button class="w-full text-left p-3 hover:bg-accent rounded-lg transition-colors">
            <div class="font-medium text-primary">ℹ️ À propos</div>
            <div class="text-sm text-secondary">Version 0.1.0</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { UserProfile } from '@/types'

const editProfile = ref(false)

const profile = ref<UserProfile>({
  id: '1',
  username: 'FootballFan2024',
  stats: {
    totalQuizzes: 12,
    totalQuestions: 145,
    correctAnswers: 98,
    averageScore: 68,
    bestScore: 95,
    currentStreak: 3,
    bestStreak: 7,
    categoryStats: {},
  },
  preferences: {
    theme: 'light',
    soundEnabled: true,
    timeLimit: true,
    notifications: true,
  },
})

const editedProfile = ref({ ...profile.value })

const userInitials = computed(() => {
  return profile.value.username
    .split(' ')
    .map((name) => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const memberSince = computed(() => {
  return 'juin 2025' // Mock data
})

const saveProfile = () => {
  profile.value.username = editedProfile.value.username
  editProfile.value = false
  // Ici on sauvegarderait dans un store ou une API
}

const cancelEdit = () => {
  editedProfile.value = { ...profile.value }
  editProfile.value = false
}

const toggleTheme = () => {
  profile.value.preferences.theme = profile.value.preferences.theme === 'light' ? 'dark' : 'light'

  // Applique le thème à l'élément BODY (pas HTML)
  if (profile.value.preferences.theme === 'dark') {
    document.body.classList.add('dark')
  } else {
    document.body.classList.remove('dark')
  }

  // Sauvegarde dans localStorage
  localStorage.setItem('theme', profile.value.preferences.theme)
}

const toggleSound = () => {
  profile.value.preferences.soundEnabled = !profile.value.preferences.soundEnabled
}

const toggleTimeLimit = () => {
  profile.value.preferences.timeLimit = !profile.value.preferences.timeLimit
}

const toggleNotifications = () => {
  profile.value.preferences.notifications = !profile.value.preferences.notifications
}

// Initialisation du thème au montage du composant
onMounted(() => {
  // Récupère le thème depuis localStorage ou utilise celui du profil
  const savedTheme = localStorage.getItem('theme') || profile.value.preferences.theme
  profile.value.preferences.theme = savedTheme as 'light' | 'dark'

  // Applique le thème sur le BODY
  if (savedTheme === 'dark') {
    document.body.classList.add('dark')
  } else {
    document.body.classList.remove('dark')
  }
})
</script>
