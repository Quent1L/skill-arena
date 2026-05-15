<template>
  <div class="match-detail-view max-w-4xl mx-auto p-6">
    <div v-if="loading" class="text-center">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="text-center text-red-500">
      <p>{{ error }}</p>
      <Button label="Retour" @click="goBack()" />
    </div>

    <div v-else-if="match" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <Button label="Retour" icon="fa fa-arrow-left" severity="secondary" @click="goBack()" />

        <div class="flex items-center gap-3">
          <Button
            v-if="canEditMatch"
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
      <div class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden">
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
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

        <div class="p-4">
          <div class="space-y-6">
            <!-- Scores et Vainqueur -->
            <div
              class="flex justify-center items-start gap-8 p-6 bg-surface-50 dark:bg-surface-900 rounded-lg"
            >
              <div class="text-center flex-1" :class="{ 'opacity-50': sideB?.isWinner }">
                <div class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {{ sideA?.entryName ?? 'Équipe A' }}
                </div>
                <div
                  v-if="match.tournament?.scoreEnabled !== false"
                  class="text-5xl font-bold"
                  :class="sideA?.isWinner ? 'text-green-600' : 'text-primary'"
                >
                  {{ sideA?.score }}
                </div>
                <div v-if="sideA?.players" class="mt-2 text-sm">
                  <div
                    v-for="p in sideA.players"
                    :key="p.id"
                    class="flex items-center justify-center gap-1"
                  >
                    <RouterLink
                      v-if="p.id"
                      :to="{ path: `/players/${p.id}`, query: match.tournamentId ? { tournamentId: match.tournamentId } : {} }"
                      class="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {{ p.displayName }}
                    </RouterLink>
                    <span v-else>{{ p.displayName }}</span>
                    <template
                      v-if="match.status === 'finalized' && match.tournament?.mode === 'championship' && p.effectivePointsAwarded !== undefined"
                    >
                      <Tag
                        v-if="p.exceededMatchLimit"
                        value="hors limite"
                        severity="secondary"
                        class="text-xs"
                      />
                      <span v-else class="font-semibold text-green-600 dark:text-green-400">
                        +{{ p.effectivePointsAwarded }} pt{{
                          p.effectivePointsAwarded !== 1 ? 's' : ''
                        }}
                      </span>
                    </template>
                    <template
                      v-if="match.status === 'finalized' && match.tournament?.mode === 'ranked' && p.mmrDelta !== undefined"
                    >
                      <span
                        class="font-semibold"
                        :class="p.mmrDelta && p.mmrDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                      >
                        {{ p.mmrDelta && p.mmrDelta > 0 ? '+' : '' }}{{ p.mmrDelta }} MMR
                      </span>
                    </template>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="sideA?.isWinner"
                    value="Vainqueur"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>

              <div
                v-if="match.tournament?.scoreEnabled !== false"
                class="text-3xl font-bold text-surface-400 pt-8"
              >
                -
              </div>

              <div class="text-center flex-1" :class="{ 'opacity-50': sideA?.isWinner }">
                <div class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {{ sideB?.entryName ?? 'Équipe B' }}
                </div>
                <div
                  v-if="match.tournament?.scoreEnabled !== false"
                  class="text-5xl font-bold"
                  :class="sideB?.isWinner ? 'text-green-600' : 'text-primary'"
                >
                  {{ sideB?.score }}
                </div>
                <div v-if="sideB?.players" class="mt-2 text-sm">
                  <div
                    v-for="p in sideB.players"
                    :key="p.id"
                    class="flex items-center justify-center gap-1"
                  >
                    <RouterLink
                      v-if="p.id"
                      :to="{ path: `/players/${p.id}`, query: match.tournamentId ? { tournamentId: match.tournamentId } : {} }"
                      class="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {{ p.displayName }}
                    </RouterLink>
                    <span v-else>{{ p.displayName }}</span>
                    <template
                      v-if="match.status === 'finalized' && match.tournament?.mode === 'championship' && p.effectivePointsAwarded !== undefined"
                    >
                      <Tag
                        v-if="p.exceededMatchLimit"
                        value="hors limite"
                        severity="secondary"
                        class="text-xs"
                      />
                      <span v-else class="font-semibold text-green-600 dark:text-green-400">
                        +{{ p.effectivePointsAwarded }} pt{{
                          p.effectivePointsAwarded !== 1 ? 's' : ''
                        }}
                      </span>
                    </template>
                    <template
                      v-if="match.status === 'finalized' && match.tournament?.mode === 'ranked' && p.mmrDelta !== undefined"
                    >
                      <span
                        class="font-semibold"
                        :class="p.mmrDelta && p.mmrDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                      >
                        {{ p.mmrDelta && p.mmrDelta > 0 ? '+' : '' }}{{ p.mmrDelta }} MMR
                      </span>
                    </template>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="sideB?.isWinner"
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
              <div v-if="match.outcomeType">
                <span class="text-surface-500 dark:text-surface-400">Type de résultat :</span>
                <span class="ml-2 font-semibold">{{ match.outcomeType.name }}</span>
              </div>
              <div v-if="match.outcomeReason">
                <span class="text-surface-500 dark:text-surface-400">Raison du résultat :</span>
                <span class="ml-2 font-semibold">{{ match.outcomeReason.name }}</span>
              </div>
              <div v-if="match.result?.finalizedAt">
                <span class="text-surface-500 dark:text-surface-400">Finalisé le :</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.result.finalizedAt) }}</span>
              </div>
              <div v-if="match.result?.finalizationReason">
                <span class="text-surface-500 dark:text-surface-400">Finalisation :</span>
                <span class="ml-2 font-semibold">
                  <template v-if="match.result.finalizationReason === 'trust_score'">
                    Trust Score de {{ match.result.reporter?.displayName ?? 'inconnu' }}
                  </template>
                  <template v-else>
                    {{ getFinalizationReasonLabel(match.result.finalizationReason) }}
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <!-- MMR Reveal Animation (ranked matches only) -->
      <MmrRevealAnimation
        v-if="match.tournament?.mode === 'ranked' && animationQueue.currentEvent.value"
        :event="animationQueue.currentEvent.value"
        :tiers="detailStore.rankedTiers"
        @close="animationQueue.acknowledgeCurrentEvent()"
      />
      <MmrRecapCard
        v-else-if="match.tournament?.mode === 'ranked' && animationQueue.showRecap.value"
        :events="animationQueue.queue.value"
        @close="animationQueue.dismissAll()"
      />

      <!-- Admin Actions -->
      <div
        v-if="canManageMatch && match.status !== 'finalized'"
        class="rounded-xl border border-warn-300 dark:border-warn-700 bg-warn-50 dark:bg-warn-900/20 overflow-hidden"
      >
        <div class="p-4 border-b border-warn-300 dark:border-warn-700">
          <h3 class="text-lg font-semibold text-warn-700 dark:text-warn-300">
            <i class="fa fa-shield-alt mr-2"></i>
            Actions administrateur
          </h3>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-sm text-surface-600 dark:text-surface-400">
            En tant qu'administrateur, vous pouvez finaliser manuellement ce match.
          </p>
          <div class="flex gap-3">
            <Button
              label="Finaliser (Consensus)"
              severity="success"
              @click="() => handleFinalize('consensus')"
            />
            <Button
              label="Finaliser (Override admin)"
              severity="warn"
              @click="() => handleFinalize('admin_override')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchService } from '@/composables/match/match.service'
import { useAuth } from '@/composables/useAuth'
import type { ClientMatchDetail, MatchFinalizationReason, MmrAnimationWsPayload } from '@skill-arena/shared/types/index'
import MatchConfirmation from '@/components/match/MatchConfirmation.vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store.ts'
import MmrRevealAnimation from '@/components/ranked/MmrRevealAnimation.vue'
import MmrRecapCard from '@/components/ranked/MmrRecapCard.vue'
import { useMMrAnimationQueue } from '@/composables/ranked/useMMrAnimationQueue'
import { onWsEvent } from '@/composables/notification/notification.socket'

const route = useRoute()
const router = useRouter()

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else if (match.value?.tournamentId) {
    router.push(`/tournaments/${match.value.tournamentId}`)
  } else {
    router.push('/')
  }
}
const { getMatch, confirmMatchResult, finalizeMatch, cancelMatch } = useMatchService()
const { appUser } = useAuth()
const detailStore = useTournamentDetailStore()

const match = ref<ClientMatchDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const confirming = ref(false)
const cancelling = ref(false)
const showCancelDialog = ref(false)

const animationQueue = useMMrAnimationQueue()
let offWs: (() => void) | null = null

function initAnimationIfRanked() {
  if (!match.value || match.value.tournament?.mode !== 'ranked' || !appUser.value) return
  animationQueue.loadPending(match.value.tournamentId!)
  offWs = onWsEvent('mmr_animation', (data: MmrAnimationWsPayload) => {
    animationQueue.enqueue(data)
  })
}

onUnmounted(() => {
  if (offWs) offWs()
})

const currentUser = computed(() => appUser.value)

const sideA = computed(() => match.value?.sides.find((s) => s.position === 1))
const sideB = computed(() => match.value?.sides.find((s) => s.position === 2))

const canManageMatch = computed(() => {
  return appUser.value?.role === 'super_admin' || appUser.value?.role === 'tournament_admin'
})

const isParticipant = computed(() => {
  if (!match.value || !appUser.value) return false
  const uid = appUser.value.id
  return match.value.sides.some((s) => s.players.some((p) => p.id === uid))
})

const canCancelMatch = computed(() => {
  if (!match.value) return false

  if (
    match.value.status === 'finalized' ||
    match.value.status === 'cancelled' ||
    match.value.tournament?.mode === 'bracket'
  )
    return false
  return canManageMatch.value || isParticipant.value
})

const canEditMatch = computed(() => {
  if (!match.value) return false
  return match.value.status === 'scheduled' && (isParticipant.value || canManageMatch.value)
})

async function loadMatch() {
  try {
    loading.value = true
    error.value = null
    const matchId = route.params.id as string
    match.value = await getMatch(matchId)
    initAnimationIfRanked()
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
    match.value = await getMatch(match.value.id)
    void updatedMatch
  } catch (err) {
    console.error('Error confirming match:', err)
  } finally {
    confirming.value = false
  }
  refreshTournament()
}

async function refreshTournament() {
  detailStore.reloadStats()
  detailStore.reloadTournament()
  if (detailStore.tournament?.mode === 'ranked') detailStore.reloadLeaderboard()
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

    await cancelMatch(match.value.id)
    match.value = await getMatch(match.value.id)
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
    await finalizeMatch(match.value.id, {
      finalizationReason: reason,
    })
    match.value = await getMatch(match.value.id)
  } catch (err) {
    console.error('Error finalizing match:', err)
  }
  refreshTournament();
}

function completeMatch() {
  if (!match.value || !match.value.tournamentId) return
  router.push(`/tournaments/${match.value.tournamentId}/create-match?matchId=${match.value.id}`)
}

function getFinalizationReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    consensus: 'Consensus',
    auto_validation: 'Validation automatique',
    admin_override: 'Décision administrative',
    trust_score: 'Trust Score',
  }
  return labels[reason] || reason
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
