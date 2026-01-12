<template>
  <div class="match-detail-view max-w-4xl mx-auto p-6">
    <div v-if="loading" class="text-center">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="text-center text-red-500">
      <p>{{ error }}</p>
      <Button label="Retour" @click="router.back()" />
    </div>

    <div v-else-if="match" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <Button
          label="Retour"
          icon="fa fa-arrow-left"
          severity="secondary"
          @click="router.back()"
        />

        <div class="flex items-center gap-3">
          <Button
            v-if="match.status === 'scheduled'"
            label="Compléter le match"
            icon="fas fa-edit"
            severity="info"
            @click="completeMatch"
          />
          <Tag :value="getStatusLabel(match.status)" :severity="getStatusSeverity(match.status)" />
        </div>
      </div>

      <!-- Match Info Card -->
      <Card>
        <template #header>
          <div class="p-4">
            <h2 class="text-2xl font-bold">Match</h2>
            <p v-if="match.tournament" class="text-surface-500 dark:text-surface-400">
              {{ match.tournament.name }}
            </p>
          </div>
        </template>

        <template #content>
          <div class="space-y-6">
            <!-- Scores et Vainqueur (only shown if not scheduled) -->
            <div
              v-if="match.status !== 'scheduled'"
              class="flex justify-center items-start gap-8 p-6 bg-surface-50 dark:bg-surface-800 rounded-lg"
            >
              <div class="text-center flex-1" :class="{ 'opacity-50': isWinnerB }">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">
                  {{ getTeamALabel }}
                </div>
                <div
                  class="text-5xl font-bold"
                  :class="isWinnerA ? 'text-green-600' : 'text-primary'"
                >
                  {{ scoreA }}
                </div>
                <div v-if="p1?.players" class="mt-2 text-sm">
                  <div v-for="p in p1.players" :key="p.player?.id">
                    {{ p.player?.displayName }}
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="isWinnerA"
                    value="Vainqueur"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>

              <div class="text-3xl font-bold text-surface-400 pt-8">-</div>

              <div class="text-center flex-1" :class="{ 'opacity-50': isWinnerA }">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">
                  {{ getTeamBLabel }}
                </div>
                <div
                  class="text-5xl font-bold"
                  :class="isWinnerB ? 'text-green-600' : 'text-primary'"
                >
                  {{ scoreB }}
                </div>
                <div v-if="p2?.players" class="mt-2 text-sm">
                  <div v-for="p in p2.players" :key="p.player?.id">
                    {{ p.player?.displayName }}
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="isWinnerB"
                    value="Vainqueur"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>
            </div>

            <!-- Teams display for scheduled matches -->
            <div
              v-else
              class="flex justify-center items-start gap-8 p-6 bg-surface-50 dark:bg-surface-800 rounded-lg"
            >
              <div class="text-center flex-1">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">
                  {{ getTeamALabel }}
                </div>
                <div v-if="p1?.players" class="mt-2 text-sm">
                  <div v-for="p in p1.players" :key="p.player?.id">
                    {{ p.player?.displayName }}
                  </div>
                </div>
              </div>

              <div class="text-3xl font-bold text-surface-400 pt-8">vs</div>

              <div class="text-center flex-1">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">
                  {{ getTeamBLabel }}
                </div>
                <div v-if="p2?.players" class="mt-2 text-sm">
                  <div v-for="p in p2.players" :key="p.player?.id">
                    {{ p.player?.displayName }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Match Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-surface-500 dark:text-surface-400">Date du match :</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.playedAt) }}</span>
              </div>
              <div v-if="match.reportedAt">
                <span class="text-surface-500 dark:text-surface-400">Résultat saisi le :</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.reportedAt) }}</span>
              </div>
              <div v-if="match.outcomeType">
                <span class="text-surface-500 dark:text-surface-400">Type de résultat :</span>
                <span class="ml-2 font-semibold">{{ match.outcomeType.name }}</span>
              </div>
              <div v-if="match.outcomeReason">
                <span class="text-surface-500 dark:text-surface-400">Raison du résultat :</span>
                <span class="ml-2 font-semibold">{{ match.outcomeReason.name }}</span>
              </div>
              <div v-if="match.confirmationDeadline">
                <span class="text-surface-500 dark:text-surface-400"
                  >Date limite de confirmation :</span
                >
                <span class="ml-2 font-semibold">{{ formatDate(match.confirmationDeadline) }}</span>
              </div>
              <div v-if="match.finalizedAt">
                <span class="text-surface-500 dark:text-surface-400">Finalisé le :</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.finalizedAt) }}</span>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Match Confirmation Component -->
      <MatchConfirmation
        :match="match"
        :current-user-id="currentUser?.id"
        :confirming="confirming"
        :contesting="contesting"
        @confirm="handleConfirm"
        @contest="handleContest"
      />

      <!-- Admin Actions -->
      <Card v-if="canManageMatch" class="bg-warn-50 dark:bg-warn-900/20">
        <template #header>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-warn-700 dark:text-warn-300">
              <i class="fa fa-shield-alt mr-2"></i>
              Actions administrateur
            </h3>
          </div>
        </template>

        <template #content>
          <div class="space-y-3">
            <p class="text-sm text-surface-600 dark:text-surface-400">
              En tant qu'administrateur, vous pouvez finaliser manuellement ce match.
            </p>
            <div class="flex gap-3">
              <Button
                label="Finaliser (Consensus)"
                severity="success"
                @click="() => handleFinalize('consensus')"
                :disabled="match.status === 'finalized'"
              />
              <Button
                label="Finaliser (Override admin)"
                severity="warn"
                @click="() => handleFinalize('admin_override')"
                :disabled="match.status === 'finalized'"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchService } from '@/composables/match/match.service'
import { useAuth } from '@/composables/useAuth'
import type { ClientMatchModel, MatchFinalizationReason } from '@skill-arena/shared/types/index'
import MatchConfirmation from '@/components/match/MatchConfirmation.vue'
import { getParticipant, getParticipantName, getScore, isWinner } from '@/utils/match-participants'

const route = useRoute()
const router = useRouter()
const { getMatch, confirmMatchResult, contestMatchResult, finalizeMatch } = useMatchService()
const { appUser } = useAuth()

const match = ref<ClientMatchModel | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const confirming = ref(false)
const contesting = ref(false)

const currentUser = computed(() => appUser.value)

const canManageMatch = computed(() => {
  // Logique pour déterminer si l'utilisateur peut gérer le match
  // À adapter selon votre système d'auth
  return appUser.value?.role === 'super_admin' || appUser.value?.role === 'tournament_admin'
})

// Helper accessors for template
const p1 = computed(() => match.value ? getParticipant(match.value, 1) : undefined)
const p2 = computed(() => match.value ? getParticipant(match.value, 2) : undefined)

const scoreA = computed(() => match.value ? getScore(match.value, 1) : 0)
const scoreB = computed(() => match.value ? getScore(match.value, 2) : 0)

const isWinnerA = computed(() => match.value ? isWinner(match.value, 1) : false)
const isWinnerB = computed(() => match.value ? isWinner(match.value, 2) : false)


// Get team/opponent label for bracket matches
const getTeamALabel = computed(() => {
  if (!match.value) return 'Équipe A'
  // For bracket matches, use opponent1 name if available and NO participant is set (pseudo-bye handling?)
  // Actually, getParticipantName handles Team name or Players.
  if (!p1.value) {
     // Check bracket opponent fallback
      const opponent1 = match.value.opponent1 as { id?: string; name?: string } | undefined
      if (opponent1?.name) return opponent1.name
      return 'Équipe A'
  }
  return getParticipantName(p1.value)
})

const getTeamBLabel = computed(() => {
  if (!match.value) return 'Équipe B'
   if (!p2.value) {
      const opponent2 = match.value.opponent2 as { id?: string; name?: string } | undefined
      if (opponent2?.name) return opponent2.name
      return 'Équipe B'
  }
  return getParticipantName(p2.value)
})

async function loadMatch() {
  try {
    loading.value = true
    error.value = null
    const matchId = route.params.id as string
    match.value = await getMatch(matchId)
  } catch (err) {
    console.error('Error loading match:', err)
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du match'
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  if (!match.value) return

  try {
    confirming.value = true
    const updatedMatch = await confirmMatchResult(match.value.id)
    match.value = updatedMatch
  } catch (err) {
    console.error('Error confirming match:', err)
  } finally {
    confirming.value = false
  }
}

async function handleContest(data: { reason?: string; proof?: string }) {
  if (!match.value) return

  try {
    contesting.value = true
    const updatedMatch = await contestMatchResult(match.value.id, {
      contestationReason: data.reason,
      contestationProof: data.proof,
    })
    match.value = updatedMatch
  } catch (err) {
    console.error('Error contesting match:', err)
  } finally {
    contesting.value = false
  }
}

async function handleFinalize(reason: MatchFinalizationReason) {
  if (!match.value) return

  try {
    const updatedMatch = await finalizeMatch(match.value.id, {
      finalizationReason: reason,
    })
    match.value = updatedMatch
  } catch (err) {
    console.error('Error finalizing match:', err)
  }
}

function completeMatch() {
  if (!match.value || !match.value.tournamentId) return
  
  // Build query params with match data to pre-fill the form
  const params = new URLSearchParams({
    matchId: match.value.id,
  })
  
  router.push(`/tournaments/${match.value.tournamentId}/create-match?${params.toString()}`)
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: 'Planifié',
    reported: 'Résultat saisi',
    pending_confirmation: 'En attente de confirmation',
    confirmed: 'Confirmé',
    disputed: 'Contesté',
    finalized: 'Finalisé',
    cancelled: 'Annulé',
  }
  return labels[status] || status
}

function getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    scheduled: 'info',
    reported: 'warn',
    pending_confirmation: 'warn',
    confirmed: 'success',
    disputed: 'danger',
    finalized: 'success',
    cancelled: 'secondary',
  }
  return severities[status] || 'info'
}

function formatDate(date?: Date | string) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  loadMatch()
})
</script>

<style scoped>
.match-detail-view {
  min-height: 100vh;
}
</style>
