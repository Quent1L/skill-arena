<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sticky header -->
    <div
      class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        <Button
          icon="fa fa-arrow-left"
          text
          rounded
          @click="router.push(`/tournaments/${tournamentId}`)"
          class="text-gray-700 dark:text-gray-200"
        />
        <div class="flex-1 min-w-0">
          <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate">
            {{ rule?.title || 'Règlement' }}
          </h1>
          <p v-if="tournamentName" class="text-sm text-gray-500 dark:text-gray-400 truncate">
            {{ tournamentName }}
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div v-if="loading" class="flex justify-center py-12">
        <ProgressSpinner />
      </div>

      <Message v-else-if="error" severity="error">
        {{ error }}
      </Message>

      <Card v-else-if="rule">
        <template #content>
          <article class="prose prose-gray dark:prose-invert max-w-none" v-html="rule.content" />
        </template>
      </Card>

      <Card v-else>
        <template #content>
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            Aucun règlement disponible pour ce tournoi.
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'

const route = useRoute()
const router = useRouter()
const { currentRule, loading, error, loadRuleById } = useGameRulesService()
const { currentTournament, loadTournamentWithErrorHandling } = useTournamentService()

const tournamentId = computed(() => route.params.id as string)
const tournamentName = computed(() => currentTournament.value?.name)
const rule = currentRule

onMounted(async () => {
  await loadTournamentWithErrorHandling(tournamentId.value)
  const tournament = currentTournament.value
  if (tournament?.rulesId) {
    await loadRuleById(tournament.rulesId)
  }
})
</script>

<style scoped>
:deep(.prose h1) {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
:deep(.prose h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}
:deep(.prose h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
:deep(.prose ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.prose ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
:deep(.prose p) {
  margin: 0.5rem 0;
}
:deep(.prose strong) {
  font-weight: 700;
}
:deep(.prose em) {
  font-style: italic;
}
:deep(.prose u) {
  text-decoration: underline;
}
</style>
