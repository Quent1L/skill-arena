<template>
  <Card v-if="shouldShowConfirmation" class="match-confirmation">
    <template #header>
      <div class="flex items-center gap-3">
        <i class="fa fa-check-circle text-2xl text-primary"></i>
        <h3 class="text-xl font-semibold">{{ t('matchConfirmation.title') }}</h3>
      </div>
    </template>

    <template #content>
      <div class="space-y-4">
        <!-- Mode de validation banner -->
        <div
          v-if="match.tournament?.validationMode"
          class="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          :class="validationModeBannerClass"
        >
          <i :class="['fa', validationModeIcon]" />
          <span>{{ validationModeMessage }}</span>
        </div>

        <!-- Infos de saisie -->
        <div class="bg-surface-50 dark:bg-surface-800 p-3 rounded-lg text-center text-sm text-surface-500 dark:text-surface-400">
          <p>
            {{ t('matchConfirmation.reportedByPrefix') }}
            <span class="font-semibold">{{ match.result?.reporter?.displayName || t('matchConfirmation.unknownReporter') }}</span>
            {{ t('matchConfirmation.reportedBySuffix') }} {{ formatDate(match.result?.reportedAt) }}
          </p>
        </div>

        <!-- Score contesté avec proposition active -->
        <div
          v-if="activeProposal"
          class="p-4 rounded-lg border-2 border-warn-400 dark:border-warn-500 bg-warn-50 dark:bg-warn-900/20 space-y-3"
        >
          <div class="flex items-center gap-2 text-warn-700 dark:text-warn-300 text-sm font-semibold">
            <i class="fa fa-exclamation-triangle"></i>
            {{ t('matchConfirmation.contestedScorePrefix') }}
            <span class="font-bold">{{ activeProposal.player?.displayName || t('matchConfirmation.unknownPlayer') }}</span>
          </div>

          <div v-if="match.tournament?.scoreEnabled !== false" class="flex items-center justify-center gap-6">
            <div class="text-center">
              <p class="text-xs text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-wide">{{ t('matchConfirmation.originalScore') }}</p>
              <p class="text-2xl font-bold text-surface-400 dark:text-surface-500 line-through">
                {{ sideA?.score ?? 0 }} - {{ sideB?.score ?? 0 }}
              </p>
            </div>

            <i class="fa fa-arrow-right text-warn-500 text-xl"></i>

            <div class="text-center">
              <p class="text-xs text-warn-600 dark:text-warn-400 mb-1 uppercase tracking-wide font-semibold">{{ t('matchConfirmation.proposedScore') }}</p>
              <p class="text-3xl font-bold text-warn-700 dark:text-warn-300">
                {{ activeProposal.proposedScoreA }} - {{ activeProposal.proposedScoreB }}
              </p>
            </div>
          </div>

          <div v-if="activeProposal.contestationReason" class="text-sm text-surface-600 dark:text-surface-400 border-t border-warn-200 dark:border-warn-700 pt-2">
            <span class="font-semibold">{{ t('matchConfirmation.reasonLabel') }}</span> {{ activeProposal.contestationReason }}
          </div>
          <div v-if="activeProposal.proposedWinnerPosition" class="text-sm text-surface-600 dark:text-surface-400 border-t border-warn-200 dark:border-warn-700 pt-2">
            <span class="font-semibold text-warn-600 dark:text-warn-400">{{ t('matchConfirmation.proposedWinner') }}</span>
            <span class="ml-2 font-bold">{{ t('matchConfirmation.proposedWinnerTeam', { position: activeProposal.proposedWinnerPosition }) }}</span>
          </div>
          <div v-if="activeProposal.proposedOutcomeType" class="text-sm text-surface-600 dark:text-surface-400 border-t border-warn-200 dark:border-warn-700 pt-2">
            <span class="font-semibold text-warn-600 dark:text-warn-400">{{ t('matchConfirmation.proposedOutcomeType') }}</span>
            <span class="ml-2 font-bold">{{ activeProposal.proposedOutcomeType.name }}</span>
          </div>
          <div v-if="activeProposal.proposedOutcomeReason" class="text-sm text-surface-600 dark:text-surface-400 border-t border-warn-200 dark:border-warn-700 pt-2">
            <span class="font-semibold text-warn-600 dark:text-warn-400">{{ t('matchConfirmation.proposedOutcomeReason') }}</span>
            <span class="ml-2 font-bold">{{ activeProposal.proposedOutcomeReason.name }}</span>
          </div>
        </div>

        <!-- Score normal -->
        <div v-else-if="match.tournament?.scoreEnabled !== false" class="flex items-center justify-center gap-4 py-2">
          <div class="text-center">
            <p class="text-xs text-surface-400 dark:text-surface-500 mb-1 uppercase tracking-wide">{{ t('matchConfirmation.score') }}</p>
            <p class="text-3xl font-bold text-primary">{{ sideA?.score ?? 0 }} - {{ sideB?.score ?? 0 }}</p>
          </div>
        </div>

        <!-- Statut des confirmations par side -->
        <div v-if="playersWithStatus && playersWithStatus.length > 0" class="space-y-3">
          <h4 class="font-semibold text-surface-700 dark:text-surface-300">
            {{ t('matchConfirmation.playerConfirmations', { confirmed: confirmedCount, total: totalPlayers }) }}
          </h4>

          <div class="space-y-2">
            <div
              v-for="player in playersWithStatus"
              :key="player.playerId"
              class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg space-y-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <i
                    :class="[
                      'fa text-lg',
                      player.status === 'confirmed' ? 'fa-check-circle text-green-500' :
                      player.status === 'contested' ? 'fa-times-circle text-red-500' :
                      'fa-clock text-surface-400'
                    ]"
                  ></i>
                  <div>
                    <span class="font-medium">{{ player.displayName }}</span>
                    <span v-if="player.sideLabel" class="ml-2 text-xs text-surface-400 dark:text-surface-500">
                      ({{ player.sideLabel }})
                    </span>
                  </div>
                </div>

                <Tag
                  v-if="player.status === 'confirmed'"
                  severity="success"
                  :value="t('matchConfirmation.tagAccepted')"
                />
                <Tag
                  v-else-if="player.status === 'contested'"
                  severity="danger"
                  :value="t('matchConfirmation.tagContested')"
                />
                <Tag
                  v-else
                  severity="warn"
                  :value="t('matchConfirmation.tagPending')"
                />
              </div>

              <div
                v-if="player.status === 'contested' && (player.contestationReason || player.contestationProof || player.hasProposal)"
                class="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 space-y-2"
              >
                <div v-if="player.hasProposal && match.tournament?.scoreEnabled !== false" class="text-sm">
                  <span class="font-semibold text-warn-600 dark:text-warn-400">{{ t('matchConfirmation.proposedScoreInline') }}</span>
                  <span class="ml-2 font-bold">{{ player.proposedScoreA }} - {{ player.proposedScoreB }}</span>
                </div>
                <div v-if="player.contestationReason" class="text-sm">
                  <span class="font-semibold text-surface-700 dark:text-surface-300">{{ t('matchConfirmation.reasonLabel') }}</span>
                  <p class="text-surface-600 dark:text-surface-400 mt-1 whitespace-pre-wrap">
                    {{ player.contestationReason }}
                  </p>
                </div>
                <div v-if="player.contestationProof" class="text-sm">
                  <span class="font-semibold text-surface-700 dark:text-surface-300">{{ t('matchConfirmation.proofLabel') }}</span>
                  <p class="text-surface-600 dark:text-surface-400 mt-1">
                    <a
                      v-if="isUrl(player.contestationProof)"
                      :href="player.contestationProof"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary hover:underline"
                    >
                      {{ player.contestationProof }}
                    </a>
                    <span v-else>{{ player.contestationProof }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Deadline -->
        <div v-if="match.confirmationDeadline" class="p-3 bg-warn-50 dark:bg-warn-900/20 rounded-lg">
          <div class="flex items-center gap-2 text-sm">
            <i class="fa fa-clock text-warn-600 dark:text-warn-400"></i>
            <span class="text-surface-700 dark:text-surface-300">
              {{ t('matchConfirmation.deadlineLabel') }} {{ formatDate(match.confirmationDeadline) }}
              <span v-if="!isExpired" class="text-warn-600 dark:text-warn-400 font-semibold">
                ({{ timeRemaining }})
              </span>
              <span v-else class="text-red-600 dark:text-red-400 font-semibold">
                {{ t('matchConfirmation.expired') }}
              </span>
            </span>
          </div>
        </div>

        <!-- Actions pour le joueur connecté -->
        <div v-if="canUserRespond" class="space-y-3">
          <Divider />

          <div v-if="!userResponse">
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">
              {{ activeProposal ? t('matchConfirmation.questionAcceptProposal') : t('matchConfirmation.questionConfirmResult') }}
            </p>

            <div class="flex gap-3">
              <Button
                :label="t('matchConfirmation.acceptBtn')"
                icon="fa fa-check"
                severity="success"
                :loading="responding && responseIntent === 'agree'"
                :disabled="responding"
                @click="openResponseDialog('agree')"
                class="flex-1"
              />
              <Button
                :label="t('matchConfirmation.disputeBtn')"
                icon="fa fa-times"
                severity="danger"
                :loading="responding && responseIntent === 'dispute'"
                :disabled="responding"
                @click="openResponseDialog('dispute')"
                class="flex-1"
              />
            </div>
          </div>

          <div v-else class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div class="flex items-center gap-2">
              <i
                :class="[
                  'fa text-lg',
                  userResponse.isConfirmed ? 'fa-check-circle text-green-500' :
                  'fa-times-circle text-red-500'
                ]"
              ></i>
              <span class="text-sm text-surface-700 dark:text-surface-300">
                {{ userResponse.isConfirmed ? t('matchConfirmation.userAccepted') : t('matchConfirmation.userDisputed') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- Dialog de réponse -->
  <Dialog
    v-model:visible="responseDialogVisible"
    :header="responseIntent === 'agree' ? t('matchConfirmation.dialogAcceptTitle') : t('matchConfirmation.dialogDisputeTitle')"
    :modal="true"
    :style="{ width: '480px' }"
  >
    <div class="space-y-4">
      <div v-if="responseIntent === 'dispute'" class="space-y-4">
        <div>
          <label for="disputeReason" class="block text-sm font-medium mb-2">
            {{ t('matchConfirmation.disputeReasonLabel') }}
          </label>
          <Textarea
            id="disputeReason"
            v-model="disputeReason"
            rows="3"
            :placeholder="t('matchConfirmation.disputeReasonPlaceholder')"
            class="w-full"
          />
        </div>

        <div>
          <label for="disputeProof" class="block text-sm font-medium mb-2">
            {{ t('matchConfirmation.proofInputLabel') }}
          </label>
          <InputText
            id="disputeProof"
            v-model="disputeProof"
            :placeholder="t('matchConfirmation.proofInputPlaceholder')"
            class="w-full"
          />
        </div>

        <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg text-sm text-surface-600 dark:text-surface-400">
          <i class="fa fa-info-circle mr-2"></i>
          {{ t('matchConfirmation.alternativeScoreHint') }}
        </div>
      </div>

      <div v-else class="text-sm text-surface-600 dark:text-surface-400">
        {{ t('matchConfirmation.confirmationIrreversible') }}
      </div>
    </div>

    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        @click="responseDialogVisible = false"
      />
      <Button
        v-if="responseIntent === 'dispute'"
        :label="t('matchConfirmation.enterCorrectedScoreBtn')"
        severity="warn"
        icon="fa fa-edit"
        @click="redirectToScoreForm"
      />
      <Button
        :label="responseIntent === 'agree' ? t('matchConfirmation.confirmAcceptanceBtn') : t('matchConfirmation.submitDisputeBtn')"
        :severity="responseIntent === 'agree' ? 'success' : 'danger'"
        :icon="responseIntent === 'agree' ? 'fa fa-check' : 'fa fa-flag'"
        :loading="responding"
        @click="submitResponse"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type ClientMatchDetail } from '@skill-arena/shared';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  match: ClientMatchDetail;
  currentUserId?: string;
  responding?: boolean;
}

interface Emits {
  (event: 'respond', data: { type: 'agree' | 'dispute'; reason?: string; proof?: string }): void;
  (event: 'redirectToScoreForm', data: { reason?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const responseDialogVisible = ref(false);
const responseIntent = ref<'agree' | 'dispute'>('agree');
const disputeReason = ref('');
const disputeProof = ref('');

const sideA = computed(() => props.match.sides.find((s) => s.position === 1));
const sideB = computed(() => props.match.sides.find((s) => s.position === 2));

const shouldShowConfirmation = computed(() => {
  return ['reported', 'pending_confirmation', 'disputed'].includes(props.match.status);
});

const confirmations = computed(() =>
  (props.match.confirmations ?? []).filter((c) => !c.isPostFinalization),
);

const participants = computed(() => {
  return props.match.sides.flatMap((side) =>
    side.players.map((p) => ({ playerId: p.id, displayName: p.displayName, sidePosition: side.position }))
  );
});

const totalPlayers = computed(() => participants.value.length);

const confirmedCount = computed(() => confirmations.value.filter((c) => c.isConfirmed).length);

const activeProposal = computed(() => {
  return confirmations.value.find(
    c => c.isContested && (
      (c.proposedScoreA !== null && c.proposedScoreA !== undefined &&
       c.proposedScoreB !== null && c.proposedScoreB !== undefined) ||
      (c.proposedOutcomeTypeId !== null && c.proposedOutcomeTypeId !== undefined)
    )
  ) ?? null;
});

const playersWithStatus = computed(() => {
  const confirmationsMap = new Map(confirmations.value.map((c) => [c.playerId, c]));

  return participants.value.map(participant => {
    const confirmation = confirmationsMap.get(participant.playerId);
    let status: 'confirmed' | 'contested' | 'pending' = 'pending';

    if (confirmation) {
      if (confirmation.isConfirmed) {
        status = 'confirmed';
      } else if (confirmation.isContested) {
        status = 'contested';
      }
    }

    const sidePosition = confirmation?.sidePosition ?? participant.sidePosition;
    let sideLabel: string | null = null;
    if (sidePosition === 1) sideLabel = t('matchConfirmation.sideA');
    else if (sidePosition === 2) sideLabel = t('matchConfirmation.sideB');

    return {
      playerId: participant.playerId,
      displayName: participant.displayName || t('matchConfirmation.unknownPlayerName'),
      status,
      sideLabel,
      contestationReason: confirmation?.contestationReason,
      contestationProof: confirmation?.contestationProof,
      hasProposal: confirmation?.proposedScoreA !== null && confirmation?.proposedScoreA !== undefined,
      proposedScoreA: confirmation?.proposedScoreA,
      proposedScoreB: confirmation?.proposedScoreB,
    };
  });
});

const userResponse = computed(() => {
  if (!props.currentUserId) return null;
  const confirmation = confirmations.value.find(c => c.playerId === props.currentUserId);
  if (!confirmation || (!confirmation.isConfirmed && !confirmation.isContested)) return null;
  return confirmation;
});

const canUserRespond = computed(() => {
  if (!props.currentUserId) return false;
  if (props.match.status === 'finalized') return false;
  return participants.value.some(p => p.playerId === props.currentUserId);
});

const isExpired = computed(() => {
  if (!props.match.confirmationDeadline) return false;
  return new Date(props.match.confirmationDeadline) < new Date();
});

const timeRemaining = computed(() => {
  if (!props.match.confirmationDeadline) return '';
  return formatDistanceToNow(new Date(props.match.confirmationDeadline), {
    locale: fr,
    addSuffix: true
  });
});

const validationModeMessage = computed(() => {
  const mode = props.match.tournament?.validationMode
  const hours = props.match.tournament?.validationTimerHours ?? 24
  if (mode === 'auto')
    return t('matchConfirmation.validationAuto', { hours })
  if (mode === 'strict') return t('matchConfirmation.validationStrict')
  if (mode === 'admin') return t('matchConfirmation.validationAdmin')
  if (mode === 'none') return t('matchConfirmation.validationNone')
  return ''
});

const validationModeBannerClass = computed(() => {
  const mode = props.match.tournament?.validationMode
  if (mode === 'auto') return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
  if (mode === 'strict') return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
  if (mode === 'admin') return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
  if (mode === 'none') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
  return ''
});

const validationModeIcon = computed(() => {
  const mode = props.match.tournament?.validationMode
  if (mode === 'auto') return 'fa-bolt'
  if (mode === 'strict') return 'fa-shield-halved'
  if (mode === 'admin') return 'fa-crown'
  if (mode === 'none') return 'fa-eye-slash'
  return 'fa-circle-info'
});

function formatDate(date?: Date | string) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function openResponseDialog(intent: 'agree' | 'dispute') {
  responseIntent.value = intent;
  disputeReason.value = '';
  disputeProof.value = '';
  responseDialogVisible.value = true;
}

function submitResponse() {
  emit('respond', {
    type: responseIntent.value,
    reason: disputeReason.value || undefined,
    proof: disputeProof.value || undefined,
  });
  responseDialogVisible.value = false;
}

function redirectToScoreForm() {
  emit('redirectToScoreForm', { reason: disputeReason.value || undefined });
  responseDialogVisible.value = false;
}

function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
</script>

<style scoped>
.match-confirmation {
  background: var(--surface-card);
}
</style>
