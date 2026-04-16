<template>
  <div class="space-y-6">
    <div
      v-if="store.tournament!.description"
      class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 tournament-description text-gray-700 dark:text-gray-300"
      v-html="store.tournament!.description"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" :class="store.tournament!.teamMode === 'static' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
      <!-- Participants -->
      <button
        @click="navigateTo('participants')"
        class="group flex items-center justify-between p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all text-left cursor-pointer"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <i class="fa fa-users text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-white">Participants</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Voir les joueurs inscrits</div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Badge :value="store.participantCount" severity="info" size="small" />
          <i class="fa fa-chevron-right text-gray-400 group-hover:text-primary-500 transition-colors" />
        </div>
      </button>

      <!-- Équipes (static uniquement) -->
      <button
        v-if="store.tournament!.teamMode === 'static'"
        @click="navigateTo('teams')"
        class="group flex items-center justify-between p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all text-left cursor-pointer"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <i class="fa fa-shield-halved text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-white">Équipes</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Gérer les équipes</div>
          </div>
        </div>
        <i class="fa fa-chevron-right text-gray-400 group-hover:text-primary-500 transition-colors shrink-0" />
      </button>

      <!-- Stats globale -->
      <button
        @click="navigateTo('stats')"
        class="group flex items-center justify-between p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all text-left cursor-pointer"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <i class="fa fa-chart-pie text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 dark:text-white">Stats globale</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Statistiques du tournoi</div>
          </div>
        </div>
        <i class="fa fa-chevron-right text-gray-400 group-hover:text-primary-500 transition-colors shrink-0" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store'

const store = useTournamentDetailStore()
const router = useRouter()
const route = useRoute()

function navigateTo(tab: string) {
  router.push({ name: 'tournament-tab', params: { id: route.params.id, tab } })
}
</script>

<style scoped>
:deep(.tournament-description h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
:deep(.tournament-description h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
:deep(.tournament-description ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.tournament-description p) {
  margin: 0.5rem 0;
}
:deep(.tournament-description strong) {
  font-weight: 700;
}
:deep(.tournament-description em) {
  font-style: italic;
}
:deep(.tournament-description u) {
  text-decoration: underline;
}
:deep(.tournament-description a) {
  color: rgb(59 130 246);
  text-decoration: underline;
}
</style>
