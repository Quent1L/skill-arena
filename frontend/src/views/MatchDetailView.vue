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
            size="small"
            @click="completeMatch"
          />
          <Button
            v-if="canCancelMatch"
            label="Annuler le match"
            icon="fa fa-ban"
            severity="danger"
            outlined
            :loading="cancelling"
            size="small"
            @click="showCancelDialog = true"
          />
        </div>
      </div>

      <!-- Match Info Card -->
      <Card>
        <template #header>
          <div class="p-4">
            <div class="flex justify-between">
              <div class="text-2xl font-bold">Match</div>
              <Tag
                :value="getStatusLabel(match.status)"
                :severity="getStatusSeverity(match.status)"
              />
            </div>

            <p v-if="match.tournament" class="text-surface-500 dark:text-surface-400">
              {{ match.tournament.name }}
            </p>
          </div>
        </template>

        <template #content>
          <div class="space-y-6">
            <!-- Scores et Vainqueur -->
            <div
              class="flex justify-center items-start gap-8 p-6 bg-surface-50 dark:bg-surface-800 rounded-lg"
            >
              <div class="text-center flex-1" :class="{ 'opacity-50': match.winnerSide === 'B' }">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">Équipe A</div>
                <div
                  class="text-5xl font-bold"
                  :class="match.winnerSide === 'A' ? 'text-green-600' : 'text-primary'"
                >
                  {{ match.scoreA }}
                </div>
                <div v-if="match.teamA?.participants" class="mt-2 text-sm">
                  <div v-for="p in match.teamA.participants" :key="p.user?.id">
                    <RouterLink
                      v-if="p.user?.id"
                      :to="`/players/${p.user.id}`"
                      class="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {{ p.user?.displayName }}
                    </RouterLink>
                    <span v-else>{{ p.user?.displayName }}</span>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="match.winnerSide === 'A'"
                    value="Vainqueur"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>

              <div class="text-3xl font-bold text-surface-400 pt-8">-</div>

              <div class="text-center flex-1" :class="{ 'opacity-50': match.winnerSide === 'A' }">
                <div class="text-sm text-surface-500 dark:text-surface-400 mb-2">Équipe B</div>
                <div
                  class="text-5xl font-bold"
                  :class="match.winnerSide === 'B' ? 'text-green-600' : 'text-primary'"
                >
                  {{ match.scoreB }}
                </div>
                <div v-if="match.teamB?.participants" class="mt-2 text-sm">
                  <div v-for="p in match.teamB.participants" :key="p.user?.id">
                    <RouterLink
                      v-if="p.user?.id"
                      :to="`/players/${p.user.id}`"
                      class="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {{ p.user?.displayName }}
                    </RouterLink>
                    <span v-else>{{ p.user?.displayName }}</span>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="match.winnerSide === 'B'"
                    value="Vainqueur"
                    severity="success"
                    icon="fa fa-trophy"
                  />
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
        @confirm="handleConfirm"
        @contest="handleContest"
      />

      <!-- Cancel Confirmation Dialog -->
      <Dialog
        v-model:visible="showCancelDialog"
        header="Annuler le match"
        modal
        :closable="!cancelling"
        :style="{ maxWidth: '600px' }"
      >
        <p class="text-surface-600 dark:text-surface-400">
          Êtes-vous sûr de vouloir annuler ce match ? Cette action ne peut pas être défaite.
        </p>
        <template #footer>
          <Button
            label="Non, conserver"
            severity="secondary"
            outlined
            :disabled="cancelling"
            @click="showCancelDialog = false"
          />
          <Button
            label="Oui, annuler le match"
            icon="fa fa-ban"
            severity="danger"
            :loading="cancelling"
            @click="handleCancel"
          />
        </template>
      </Dialog>

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
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchService } from '@/composables/match/match.service'
import { useAuth } from '@/composables/useAuth'
import type { ClientMatchModel, MatchFinalizationReason } from '@skill-arena/shared/types/index'
import MatchConfirmation from '@/components/match/MatchConfirmation.vue'

const route = useRoute()
const router = useRouter()
const { getMatch, confirmMatchResult, finalizeMatch, cancelMatch } = useMatchService()
const { appUser } = useAuth()

const match = ref<ClientMatchModel | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const confirming = ref(false)
const cancelling = ref(false)
const showCancelDialog = ref(false)

const currentUser = computed(() => appUser.value)

const canManageMatch = computed(() => {
  return appUser.value?.role === 'super_admin' || appUser.value?.role === 'tournament_admin'
})

const isParticipant = computed(() => {
  if (!match.value || !appUser.value) return false
  const uid = appUser.value.id
  return (
    (match.value.teamA?.participants?.some((p) => p.user?.id === uid) ||
      match.value.teamB?.participants?.some((p) => p.user?.id === uid)) ??
    false
  )
})

const canCancelMatch = computed(() => {
  if (!match.value) return false
  if (match.value.status === 'finalized' || match.value.status === 'cancelled') return false
  return canManageMatch.value || isParticipant.value
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

function handleContest(data: { reason?: string }) {
  if (!match.value?.tournamentId) return

  router.push({
    path: `/tournaments/${match.value.tournamentId}/create-match`,
    query: {
      matchId: match.value.id,
      contest: 'true',
      ...(data.reason && { contestReason: data.reason }),
    },
  })
}

async function handleCancel() {
  if (!match.value) return

  try {
    cancelling.value = true

    match.value = await cancelMatch(match.value.id)
    showCancelDialog.value = false
  } catch (err) {
    console.error('Error cancelling match:', err)
  } finally {
    cancelling.value = false
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
  router.push(`/tournaments/${match.value.tournamentId}/create-match?matchId=${match.value.id}`)
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: 'Planifié',
    reported: 'Résultat saisi',
    pending_confirmation: 'Proposition de score',
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
