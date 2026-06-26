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
            {{ rule?.title || t('tournamentRulesView.defaultTitle') }}
          </h1>
          <p v-if="tournamentName" class="text-sm text-gray-500 dark:text-gray-400 truncate">
            {{ tournamentName }}
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-4xl mx-auto px-4 py-8">
      <RulesContent :rule="rule" :loading="loading" :error="error" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import RulesContent from '@/components/rules/RulesContent.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
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
