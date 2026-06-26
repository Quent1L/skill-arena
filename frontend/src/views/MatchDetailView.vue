<template>
  <div class="match-detail-view max-w-4xl mx-auto p-2 sm:p-3 sm:p-6">
    <div v-if="loading" class="text-center">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="text-center text-red-500">
      <p>{{ error }}</p>
      <Button :label="t('matchDetailView.back')" @click="goBack()" />
    </div>

    <div v-else-if="match" class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <Button :label="t('matchDetailView.back')" icon="fa fa-arrow-left" severity="secondary" @click="goBack()" />

        <div class="flex items-center gap-3">
          <Button
            v-if="canEditMatch"
            :label="t('matchDetailView.completeMatch')"
            icon="fas fa-edit"
            severity="info"
            size="small"
            @click="completeMatch"
          />
          <Button
            v-if="canCancelMatch"
            :label="t('matchDetailView.cancelMatch')"
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
      <div
        class="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 overflow-hidden"
      >
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
          <div class="flex justify-between">
            <div class="text-2xl font-bold">{{ t('matchDetailView.matchHeading') }}</div>
            <Tag
              :value="getStatusLabel(match.status)"
              :severity="getStatusSeverity(match.status)"
            />
          </div>

          <p v-if="match.tournament" class="text-surface-500 dark:text-surface-400">
            {{ match.tournament.name }}
          </p>
        </div>

        <div class="p-1 sm:p-4">
          <div class="space-y-6">
            <!-- Scores et Vainqueur -->
            <div
              class="flex justify-center items-start gap-3 py-3 px-1 sm:gap-8 sm:p-6 bg-surface-50 dark:bg-surface-900 rounded-lg"
            >
              <div class="text-center flex-1" :class="{ 'opacity-50': sideB?.isWinner }">
                <div class="flex justify-center mb-2">
                  <PlayerAvatarStack v-if="sideA?.players" :players="sideA.players" size="sm" />
                </div>
                <div class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {{ sideA?.entryName ?? t('matchDetailView.teamA') }}
                </div>
                <div
                  v-if="match.tournament?.scoreEnabled !== false"
                  class="text-3xl sm:text-5xl font-bold"
                  :class="sideA?.isWinner ? 'text-green-600' : 'text-primary'"
                >
                  {{ sideA?.score }}
                </div>
                <div v-if="sideA?.players" class="mt-2 text-sm flex justify-center">
                  <div class="inline-flex flex-col items-start">
                    <div v-for="p in sideA.players" :key="p.id" class="flex items-center gap-1.5">
                      <RouterLink
                        v-if="p.id"
                        :to="{
                          path: `/players/${p.id}`,
                          query: match.tournamentId ? { tournamentId: match.tournamentId } : {},
                        }"
                        class="hover:underline text-blue-600 dark:text-blue-400"
                      >
                        {{ p.displayName }}
                      </RouterLink>
                      <span v-else>{{ p.displayName }}</span>
                      <template
                        v-if="
                          match.status === 'finalized' &&
                          match.tournament?.mode === 'championship' &&
                          p.effectivePointsAwarded !== undefined
                        "
                      >
                        <Tag
                          v-if="p.exceededMatchLimit"
                          :value="t('matchDetailView.overLimit')"
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
                        v-if="
                          match.status === 'finalized' &&
                          match.tournament?.mode === 'ranked' &&
                          p.mmrDelta !== undefined
                        "
                      >
                        <span
                          class="font-semibold"
                          :class="
                            p.mmrDelta && p.mmrDelta > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          "
                        >
                          {{ p.mmrDelta && p.mmrDelta > 0 ? '+' : '' }}{{ p.mmrDelta }}
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="sideA?.isWinner"
                    :value="t('matchDetailView.winner')"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>

              <div
                v-if="match.tournament?.scoreEnabled !== false"
                class="text-xl sm:text-3xl font-bold text-surface-400 pt-6 sm:pt-8"
              >
                -
              </div>

              <div class="text-center flex-1" :class="{ 'opacity-50': sideA?.isWinner }">
                <div class="flex justify-center mb-2">
                  <PlayerAvatarStack v-if="sideB?.players" :players="sideB.players" size="sm" />
                </div>
                <div class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {{ sideB?.entryName ?? t('matchDetailView.teamB') }}
                </div>
                <div
                  v-if="match.tournament?.scoreEnabled !== false"
                  class="text-3xl sm:text-5xl font-bold"
                  :class="sideB?.isWinner ? 'text-green-600' : 'text-primary'"
                >
                  {{ sideB?.score }}
                </div>
                <div v-if="sideB?.players" class="mt-2 text-sm flex justify-center">
                  <div class="inline-flex flex-col items-start">
                    <div v-for="p in sideB.players" :key="p.id" class="flex items-center gap-1.5">
                      <RouterLink
                        v-if="p.id"
                        :to="{
                          path: `/players/${p.id}`,
                          query: match.tournamentId ? { tournamentId: match.tournamentId } : {},
                        }"
                        class="hover:underline text-blue-600 dark:text-blue-400"
                      >
                        {{ p.displayName }}
                      </RouterLink>
                      <span v-else>{{ p.displayName }}</span>
                      <template
                        v-if="
                          match.status === 'finalized' &&
                          match.tournament?.mode === 'championship' &&
                          p.effectivePointsAwarded !== undefined
                        "
                      >
                        <Tag
                          v-if="p.exceededMatchLimit"
                          :value="t('matchDetailView.overLimit')"
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
                        v-if="
                          match.status === 'finalized' &&
                          match.tournament?.mode === 'ranked' &&
                          p.mmrDelta !== undefined
                        "
                      >
                        <span
                          class="font-semibold"
                          :class="
                            p.mmrDelta && p.mmrDelta > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          "
                        >
                          {{ p.mmrDelta && p.mmrDelta > 0 ? '+' : '' }}{{ p.mmrDelta }}
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
                <div class="mt-3 min-h-[32px]">
                  <Tag
                    v-if="sideB?.isWinner"
                    :value="t('matchDetailView.winner')"
                    severity="success"
                    icon="fa fa-trophy"
                  />
                </div>
              </div>
            </div>

            <!-- Match Details -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-2">
              <div>
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.matchDate') }}</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.playedAt) }}</span>
              </div>
              <div v-if="match.creator">
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.enteredBy') }}</span>
                <span class="ml-2 font-semibold"> {{ match.creator.displayName }}</span>
              </div>
              <div v-if="match.outcomeType">
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.outcomeType') }}</span>
                <span class="ml-2 font-semibold">{{ match.outcomeType.name }}</span>
              </div>
              <div v-if="match.outcomeReason">
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.outcomeReason') }}</span>
                <span class="ml-2 font-semibold">{{ match.outcomeReason.name }}</span>
              </div>
              <div v-if="match.result?.finalizedAt">
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.finalizedAt') }}</span>
                <span class="ml-2 font-semibold">{{ formatDate(match.result.finalizedAt) }}</span>
              </div>
              <div v-if="match.result?.finalizationReason">
                <span class="text-surface-500 dark:text-surface-400">{{ t('matchDetailView.finalization') }}</span>
                <span class="ml-2 font-semibold">
                  <template v-if="match.result.finalizationReason === 'trust_score'">
                    {{ t('matchDetailView.trustScoreBy', { name: match.result.reporter?.displayName ?? t('matchDetailView.unknown') }) }}
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
        :responding="responding"
        @respond="handleRespond"
        @redirect-to-score-form="handleRedirectToScoreForm"
      />

      <!-- Post-finalization dispute section -->
      <div
        v-if="postFinalizationDisputes.length > 0"
        class="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 overflow-hidden"
      >
        <div class="p-4 border-b border-red-300 dark:border-red-700">
          <h3 class="text-lg font-semibold text-red-700 dark:text-red-300">
            <i class="fa fa-flag mr-2"></i>
            {{ t('matchDetailView.postDisputesTitle') }}
          </h3>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-xs text-red-600 dark:text-red-400">
            <i class="fa fa-info-circle mr-1" />
            {{ t('matchDetailView.cancelNote') }}
          </p>
          <div
            v-for="dispute in postFinalizationDisputes"
            :key="dispute.id"
            class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg space-y-1"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ dispute.player?.displayName || t('matchDetailView.unknownPlayer') }}</span>
              <Tag severity="danger" :value="t('matchDetailView.disputed')" />
            </div>
            <div
              v-if="dispute.contestationReason"
              class="text-sm text-surface-600 dark:text-surface-400"
            >
              <span class="font-semibold">{{ t('matchDetailView.reason') }}</span> {{ dispute.contestationReason }}
            </div>
            <div
              v-if="dispute.contestationProof"
              class="text-sm text-surface-600 dark:text-surface-400"
            >
              <span class="font-semibold">{{ t('matchDetailView.proof') }}</span>
              <a
                v-if="isProofUrl(dispute.contestationProof)"
                :href="dispute.contestationProof"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-1 text-primary hover:underline"
                >{{ dispute.contestationProof }}</a
              >
              <span v-else class="ml-1">{{ dispute.contestationProof }}</span>
            </div>
            <div class="text-xs text-surface-400 dark:text-surface-500">
              {{ formatDate(dispute.createdAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Post-finalization dispute button (auto mode, participant, within 7 days) -->
      <div
        v-if="canDisputePostFinalization"
        class="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 overflow-hidden"
      >
        <div class="p-4 border-b border-orange-300 dark:border-orange-700">
          <h3 class="text-lg font-semibold text-orange-700 dark:text-orange-300">
            <i class="fa fa-exclamation-circle mr-2"></i>
            {{ t('matchDetailView.disputeResultTitle') }}
          </h3>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-sm text-surface-600 dark:text-surface-400">
            {{ t('matchDetailView.disputeResultDescription') }}
          </p>
          <p class="text-sm text-surface-500 dark:text-surface-500">
            {{ t('matchDetailView.expiresIn', { time: postFinalizationTimeRemaining }) }}
          </p>
          <Button
            :label="t('matchDetailView.disputeButton')"
            icon="fa fa-flag"
            severity="danger"
            outlined
            @click="showPostDisputeDialog = true"
          />
        </div>
      </div>

      <!-- Post-finalization dispute dialog -->
      <Dialog
        v-model:visible="showPostDisputeDialog"
        :header="t('matchDetailView.disputeFinalizedDialogTitle')"
        modal
        :style="{ maxWidth: '480px' }"
      >
        <div class="space-y-4">
          <div>
            <label for="postDisputeReason" class="block text-sm font-medium mb-2">
              {{ t('matchDetailView.disputeReasonLabel') }}
            </label>
            <Textarea
              id="postDisputeReason"
              v-model="postDisputeReason"
              rows="3"
              :placeholder="t('matchDetailView.disputeReasonPlaceholder')"
              class="w-full"
            />
          </div>
        </div>
        <template #footer>
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            :disabled="postDisputing"
            @click="showPostDisputeDialog = false"
          />
          <Button
            :label="t('matchDetailView.submitDispute')"
            icon="fa fa-flag"
            severity="danger"
            :loading="postDisputing"
            @click="handlePostDispute"
          />
        </template>
      </Dialog>

      <!-- Cancel Confirmation Dialog -->
      <Dialog
        v-model:visible="showCancelDialog"
        :header="t('matchDetailView.cancelMatch')"
        modal
        :closable="!cancelling"
        :style="{ maxWidth: '600px' }"
      >
        <p
          v-if="match.status === 'finalized'"
          class="text-orange-600 dark:text-orange-400 font-semibold mb-2"
        >
          <i class="fa fa-triangle-exclamation mr-1" />
          {{ t('matchDetailView.cancelFinalizedWarning') }}
        </p>
        <p class="text-surface-600 dark:text-surface-400">
          {{ t('matchDetailView.cancelConfirmation') }}
        </p>
        <template #footer>
          <Button
            :label="t('matchDetailView.keepMatch')"
            severity="secondary"
            outlined
            :disabled="cancelling"
            @click="showCancelDialog = false"
          />
          <Button
            :label="t('matchDetailView.confirmCancel')"
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
      <BadgeRevealAnimation
        v-else-if="match.tournament?.mode === 'ranked' && animationQueue.currentBadge.value"
        :badge="animationQueue.currentBadge.value"
        @close="animationQueue.acknowledgeCurrentBadge()"
      />

      <!-- Admin Actions -->
      <div
        v-if="canManageMatch && match.status !== 'finalized'"
        class="rounded-xl border border-warn-300 dark:border-warn-700 bg-warn-50 dark:bg-warn-900/20 overflow-hidden"
      >
        <div class="p-4 border-b border-warn-300 dark:border-warn-700">
          <h3 class="text-lg font-semibold text-warn-700 dark:text-warn-300">
            <i class="fa fa-shield-alt mr-2"></i>
            {{ t('matchDetailView.adminActionsTitle') }}
          </h3>
        </div>
        <div class="p-4 space-y-3">
          <p class="text-sm text-surface-600 dark:text-surface-400">
            {{ t('matchDetailView.adminActionsDescription') }}
          </p>
          <div class="flex gap-3">
            <Button
              :label="t('matchDetailView.finalizeConsensus')"
              severity="success"
              @click="() => handleFinalize('consensus')"
            />
            <Button
              :label="t('matchDetailView.finalizeOverride')"
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
import { useI18n } from 'vue-i18n'
import { useMatchService } from '@/composables/match/match.service'
import { useAuth } from '@/composables/useAuth'
import type {
  ClientMatchDetail,
  MatchFinalizationReason,
  MmrAnimationWsPayload,
} from '@skill-arena/shared/types/index'
import MatchConfirmation from '@/components/match/MatchConfirmation.vue'
import { useTournamentDetailStore } from '@/stores/tournamentDetail.store.ts'
import MmrRevealAnimation from '@/components/ranked/MmrRevealAnimation.vue'
import MmrRecapCard from '@/components/ranked/MmrRecapCard.vue'
import BadgeRevealAnimation from '@/components/ranked/BadgeRevealAnimation.vue'
import PlayerAvatarStack from '@/components/PlayerAvatarStack.vue'
import { useMMrAnimationQueue } from '@/composables/ranked/useMMrAnimationQueue'
import { onWsEvent } from '@/composables/notification/notification.socket'
import type { BadgeAnimationWsPayload } from '@skill-arena/shared/types/index'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const { t } = useI18n()
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
const { getMatch, respondToMatch, finalizeMatch, cancelMatch } = useMatchService()
const { appUser } = useAuth()
const detailStore = useTournamentDetailStore()

const match = ref<ClientMatchDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const responding = ref(false)
const cancelling = ref(false)
const showCancelDialog = ref(false)
const showPostDisputeDialog = ref(false)
const postDisputeReason = ref('')
const postDisputeProof = ref('')
const postDisputing = ref(false)

// animationQueue is a plain object (not reactive), so computed refs need .value in template
const animationQueue = useMMrAnimationQueue()
let offWs: (() => void) | null = null
let offBadgeWs: (() => void) | null = null

function initAnimationIfRanked() {
  if (!match.value || match.value.tournament?.mode !== 'ranked' || !appUser.value) return
  animationQueue.loadPending(match.value.tournamentId!)
  offWs = onWsEvent('mmr_animation', (data: MmrAnimationWsPayload) => {
    animationQueue.enqueue(data)
  })
  offBadgeWs = onWsEvent('badge_animation', (data: BadgeAnimationWsPayload) => {
    animationQueue.enqueueBadge(data)
  })
}

onUnmounted(() => {
  if (offWs) offWs()
  if (offBadgeWs) offBadgeWs()
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

const postFinalizationDisputes = computed(() => {
  if (!match.value) return []
  return (match.value.confirmations ?? []).filter((c) => c.isPostFinalization)
})

const canDisputePostFinalization = computed(() => {
  if (!match.value || !appUser.value) return false
  if (match.value.status !== 'finalized') return false
  const reason = match.value.result?.finalizationReason
  if (!reason || !['auto_validation', 'trust_score'].includes(reason)) return false
  if (!isParticipant.value) return false
  if (match.value.result?.reportedBy === appUser.value.id) return false

  const finalizedAt = match.value.result?.finalizedAt
  if (!finalizedAt) return false

  const daysSince = (Date.now() - new Date(finalizedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 7) return false

  const alreadyDisputed = postFinalizationDisputes.value.some(
    (d) => d.playerId === appUser.value!.id,
  )
  return !alreadyDisputed
})

const postFinalizationTimeRemaining = computed(() => {
  if (!match.value?.result?.finalizedAt) return ''
  const deadline = new Date(match.value.result.finalizedAt)
  deadline.setDate(deadline.getDate() + 7)
  return formatDistanceToNow(deadline, { locale: fr, addSuffix: true })
})

const canCancelFinalizedMatch = computed(() => {
  if (!match.value || !appUser.value) return false
  if (match.value.status !== 'finalized') return false
  const mode = match.value.tournament?.mode
  if (!['championship', 'ranked'].includes(mode ?? '')) return false
  const reason = match.value.result?.finalizationReason
  if (!['auto_validation', 'trust_score'].includes(reason ?? '')) return false
  if (match.value.result?.reportedBy !== appUser.value.id) return false
  const finalizedAt = match.value.result?.finalizedAt
  if (!finalizedAt) return false
  const hoursSince = (Date.now() - new Date(finalizedAt as Date).getTime()) / (1000 * 60 * 60)
  return hoursSince <= 48
})

const canCancelMatch = computed(() => {
  if (!match.value) return false
  if (match.value.status === 'cancelled' || match.value.tournament?.mode === 'bracket') return false
  if (match.value.status === 'finalized') return canCancelFinalizedMatch.value
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
    error.value = err instanceof Error ? err.message : t('matchDetailView.loadError')
  } finally {
    loading.value = false
  }
}

async function handleRespond(data: { type: 'agree' | 'dispute'; reason?: string; proof?: string }) {
  if (!match.value) return

  try {
    responding.value = true
    match.value = await respondToMatch(match.value.id, {
      type: data.type,
      reason: data.reason,
      proof: data.proof,
    })
  } catch (err) {
    console.error('Error responding to match:', err)
  } finally {
    responding.value = false
  }
  refreshTournament()
}

async function refreshTournament() {
  detailStore.reloadStats()
  detailStore.reloadTournament()
  if (detailStore.tournament?.mode === 'ranked') detailStore.reloadLeaderboard()
}

function handleRedirectToScoreForm(data: { reason?: string }) {
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

async function handlePostDispute() {
  if (!match.value) return

  try {
    postDisputing.value = true
    match.value = await respondToMatch(match.value.id, {
      type: 'dispute',
      reason: postDisputeReason.value || undefined,
      proof: postDisputeProof.value || undefined,
    })
    showPostDisputeDialog.value = false
    postDisputeReason.value = ''
    postDisputeProof.value = ''
  } catch (err) {
    console.error('Error submitting post-finalization dispute:', err)
  } finally {
    postDisputing.value = false
  }
}

function isProofUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
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
  refreshTournament()
}

function completeMatch() {
  if (!match.value || !match.value.tournamentId) return
  router.push(`/tournaments/${match.value.tournamentId}/create-match?matchId=${match.value.id}`)
}

function getFinalizationReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    consensus: t('matchDetailView.finalizationReason.consensus'),
    auto_validation: t('matchDetailView.finalizationReason.autoValidation'),
    admin_override: t('matchDetailView.finalizationReason.adminOverride'),
    trust_score: t('matchDetailView.finalizationReason.trustScore'),
  }
  return labels[reason] || reason
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: t('matchDetailView.status.scheduled'),
    reported: t('matchDetailView.status.reported'),
    pending_confirmation: t('matchDetailView.status.pendingConfirmation'),
    confirmed: t('matchDetailView.status.confirmed'),
    disputed: t('matchDetailView.status.disputed'),
    finalized: t('matchDetailView.status.finalized'),
    cancelled: t('matchDetailView.status.cancelled'),
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
