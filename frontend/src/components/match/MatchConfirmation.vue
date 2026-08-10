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

        <!-- Contested: nothing moves until the entry is corrected or an organizer decides -->
        <div
          v-if="isDisputed"
          class="p-4 rounded-lg border-2 border-warn-400 dark:border-warn-500 bg-warn-50 dark:bg-warn-900/20 space-y-3"
        >
          <div class="flex items-center gap-2 text-warn-700 dark:text-warn-300 text-sm font-semibold">
            <i class="fa fa-gavel"></i>
            {{ t('matchConfirmation.awaitingArbitration') }}
          </div>
          <p class="text-sm text-surface-600 dark:text-surface-400">
            {{ t('matchConfirmation.awaitingArbitrationHint') }}
          </p>
          <Button
            v-if="canUserEditResult"
            :label="t('matchConfirmation.fixMyEntryBtn')"
            icon="fa fa-pen"
            severity="warn"
            outlined
            @click="emit('editResult')"
          />
        </div>

        <!-- Score normal -->
        <div v-if="match.tournament?.scoreEnabled !== false" class="flex items-center justify-center gap-4 py-2">
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

        <!-- Actions for the logged-in player -->
        <div v-if="canUserRespond" class="space-y-3">
          <Divider />

          <div v-if="!userResponse">
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">
              {{ t('matchConfirmation.questionConfirmResult') }}
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

          <div v-else class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg space-y-3">
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

            <Button
              v-if="canWithdrawDispute"
              :label="t('matchConfirmation.withdrawDisputeBtn')"
              icon="fa fa-check"
              severity="success"
              :loading="responding"
              :disabled="responding"
              @click="openResponseDialog('agree')"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- Response dialog -->
  <Dialog
    v-model:visible="responseDialogVisible"
    :header="responseIntent === 'agree' ? acceptDialogTitle : t('matchConfirmation.dialogDisputeTitle')"
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

        <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg text-sm text-surface-600 dark:text-surface-400">
          <i class="fa fa-info-circle mr-2"></i>
          {{ t('matchConfirmation.disputeHint') }}
        </div>
      </div>

      <div v-else class="text-sm text-surface-600 dark:text-surface-400">
        {{ acceptDialogHint }}
      </div>
    </div>

    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        @click="responseDialogVisible = false"
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
import { type ClientMatchDetail } from '@skol-arena/shared';
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
  (event: 'respond', data: { type: 'agree' | 'dispute'; reason?: string }): void;
  (event: 'editResult'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();

const responseDialogVisible = ref(false);
const responseIntent = ref<'agree' | 'dispute'>('agree');
const disputeReason = ref('');

const sideA = computed(() => props.match.sides.find((s) => s.position === 1));
const sideB = computed(() => props.match.sides.find((s) => s.position === 2));

const shouldShowConfirmation = computed(() => {
  return ['reported', 'disputed'].includes(props.match.status);
});

const isDisputed = computed(() => props.match.status === 'disputed');

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
  return participants.value.some(p => p.playerId === props.currentUserId);
});

/**
 * A player who contested keeps the last word: after the discussion they may accept the
 * entry, which withdraws their contestation and re-opens the validation round.
 */
const canWithdrawDispute = computed(() => {
  return isDisputed.value && userResponse.value?.isContested === true;
});

const isWithdrawing = computed(() => canWithdrawDispute.value && responseIntent.value === 'agree');

const acceptDialogTitle = computed(() =>
  isWithdrawing.value
    ? t('matchConfirmation.withdrawDisputeTitle')
    : t('matchConfirmation.dialogAcceptTitle'),
);

const acceptDialogHint = computed(() =>
  isWithdrawing.value
    ? t('matchConfirmation.withdrawHint')
    : t('matchConfirmation.confirmationIrreversible'),
);

/**
 * Only the author of the entry can fix it, and only while it is not finalized.
 */
const canUserEditResult = computed(() => {
  if (!props.currentUserId) return false;
  return (
    props.match.result?.reportedBy === props.currentUserId ||
    props.match.createdBy === props.currentUserId
  );
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
  responseDialogVisible.value = true;
}

function submitResponse() {
  emit('respond', {
    type: responseIntent.value,
    reason: disputeReason.value || undefined,
  });
  responseDialogVisible.value = false;
}
</script>

<style scoped>
.match-confirmation {
  background: var(--surface-card);
}
</style>
