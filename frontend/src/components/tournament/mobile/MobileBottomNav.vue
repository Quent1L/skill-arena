<template>
  <div class="fixed bottom-0 left-0 right-0 bg-gray-800 flex items-center px-2 z-50 nav-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="emit('navigate', tab.id)"
      class="flex-1 relative flex flex-col items-center justify-center py-2 px-1 rounded-xl min-h-[3.5rem]"
    >
      <div
        class="absolute inset-0 rounded-xl transition-all duration-300 ease-out"
        :class="
          activeTab === tab.id
            ? 'opacity-100 scale-100 bg-gray-700/70'
            : 'opacity-0 scale-90 bg-transparent'
        "
      />
      <i
        class="relative z-10 text-xl mb-1 transition-all duration-300"
        :class="[tab.icon, activeTab === tab.id ? 'text-primary-400 scale-110' : 'text-gray-500']"
      />
      <span
        class="relative z-10 text-xs font-semibold uppercase tracking-wide transition-all duration-300"
        :class="activeTab === tab.id ? 'text-white' : 'text-gray-500'"
      >{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface NavTab {
  id: string
  label: string
  icon: string
}

const props = defineProps<{
  activeTab: string
  tournamentMode: string
  teamMode: string
  isAuthenticated: boolean
}>()

const emit = defineEmits<{
  navigate: [tab: string]
}>()

const tabs = computed<NavTab[]>(() => {
  if (props.tournamentMode === 'ranked') {
    return [
      { id: 'infos', label: 'Détail', icon: 'fas fa-info-circle' },
      { id: 'standings', label: 'Classement', icon: 'fas fa-trophy' },
      { id: 'matches', label: 'Matchs', icon: 'fas fa-gamepad' },
      { id: 'stats', label: 'Stats', icon: 'fas fa-chart-pie' },
    ]
  }

  if (props.tournamentMode === 'bracket') {
    return [
      { id: 'infos', label: 'Info', icon: 'fas fa-info-circle' },
      { id: 'bracket', label: 'Bracket', icon: 'fas fa-sitemap' },
      { id: 'matches', label: 'Matchs', icon: 'fas fa-gamepad' },
      { id: 'stats', label: 'Stats', icon: 'fas fa-chart-pie' },
      ...(props.teamMode === 'static'
        ? [{ id: 'teams', label: 'Équipes', icon: 'fas fa-users' }]
        : []),
    ]
  }

  return [
    { id: 'infos', label: 'Info', icon: 'fas fa-info-circle' },
    { id: 'standings', label: 'Classement', icon: 'fas fa-trophy' },
    { id: 'matches', label: 'Matchs', icon: 'fas fa-gamepad' },
    { id: 'stats', label: 'Stats', icon: 'fas fa-chart-pie' },
    ...(props.teamMode === 'static'
      ? [{ id: 'teams', label: 'Équipes', icon: 'fas fa-users' }]
      : []),
  ]
})
</script>

<style scoped>
.nav-bar {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(4rem + env(safe-area-inset-bottom));
}
</style>
