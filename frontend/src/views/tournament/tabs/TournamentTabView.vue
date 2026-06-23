<template>
  <component :is="resolvedTab" v-if="resolvedTab" />
  <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
    <i class="fa fa-exclamation-circle text-4xl mb-4 block"></i>
    <p>Onglet introuvable.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabComponents: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  infos: defineAsyncComponent(() => import('./TournamentInfosTab.vue')),
  participants: defineAsyncComponent(() => import('./TournamentParticipantsTab.vue')),
  teams: defineAsyncComponent(() => import('./TournamentTeamsTab.vue')),
  stats: defineAsyncComponent(() => import('./TournamentStatsCombinedTab.vue')),
  standings: defineAsyncComponent(() => import('./TournamentStandingsTab.vue')),
  bracket: defineAsyncComponent(() => import('./TournamentBracketTab.vue')),
  matches: defineAsyncComponent(() => import('./TournamentMatchesTab.vue')),
  profile: defineAsyncComponent(() => import('./TournamentProfileTab.vue')),
  badges: defineAsyncComponent(() => import('./TournamentBadgesTab.vue')),
}

const resolvedTab = computed(() => {
  const tab = route.params.tab as string
  return tabComponents[tab] ?? null
})
</script>
