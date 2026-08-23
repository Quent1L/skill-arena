<template>
  <SurfacePanel v-if="shouldShowConfirmation">
    <template #header>
      <SectionHeader icon="fa fa-check-circle" :title="t('matchConfirmation.title')" />
    </template>

    <div class="space-y-4">
      <!-- Validation mode + progress: the per-player detail lives in the scoreboard above,
           next to the names, so this panel only carries the aggregate. -->
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="match.tournament?.validationMode"
          class="font-label inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          :class="validationModeBannerClass"
        >
          <i :class="['fa', validationModeIcon]" aria-hidden="true" />
          {{ validationModeMessage }}
        </span>

        <span
          v-if="totalPlayers > 0"
          class="font-label inline-flex items-center gap-1.5 rounded-full border border-surface-600 bg-surface-900/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-color"
        >
          <i class="fa fa-user-check" aria-hidden="true" />
          {{ t('matchConfirmation.validatedCount', { confirmed: confirmedCount, total: totalPlayers }) }}
        </span>
      </div>

      <!-- Contested: nothing moves until the entry is corrected or an organizer decides -->
      <div
        v-if="isDisputed"
        class="space-y-3 rounded-xl border-l-2 border-amber-400 bg-amber-400/[0.08] p-3"
      >
        <div class="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <i class="fa fa-gavel" aria-hidden="true" />
          {{ t('matchConfirmation.awaitingArbitration') }}
        </div>
        <p class="text-sm text-white/70">
          {{ t('matchConfirmation.awaitingArbitrationHint') }}
        </p>
        <Button
          v-if="canUserEditResult"
          :label="t('matchConfirmation.fixMyEntryBtn')"
          icon="fa fa-pen"
          severity="warn"
          outlined
          size="small"
          @click="emit('editResult')"
        />
      </div>

      <!-- Deadline -->
      <div v-if="match.confirmationDeadline" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span class="font-label text-[11px] uppercase tracking-wide text-muted-color">
          {{ t('matchConfirmation.deadlineLabel') }}
        </span>
        <span class="font-semibold text-white/90">{{ formatDate(match.confirmationDeadline) }}</span>
        <span
          class="font-label inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums"
          :class="
            isExpired
              ? 'border-match-loss/30 bg-match-loss/15 text-match-loss'
              : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
          "
        >
          <i class="fa fa-clock" aria-hidden="true" />
          {{ isExpired ? t('matchConfirmation.expired') : timeRemaining }}
        </span>
      </div>

      <!-- Actions for the logged-in player -->
      <div v-if="canUserRespond" class="space-y-3 border-t border-surface-700/40 pt-4">
        <div v-if="!userResponse">
          <p class="mb-3 text-sm text-white/70">
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

        <div v-else class="space-y-3 rounded-xl border-l-2 bg-surface-900/40 p-3" :class="userResponse.isConfirmed ? 'border-match-win' : 'border-match-loss'">
          <div class="flex items-center gap-2">
            <i
              class="fa text-lg"
              :class="userResponse.isConfirmed ? 'fa-check-circle text-match-win' : 'fa-times-circle text-match-loss'"
              aria-hidden="true"
            />
            <span class="text-sm text-white/80">
              {{ userResponse.isConfirmed ? t('matchConfirmation.userAccepted') : t('matchConfirmation.userDisputed') }}
            </span>
          </div>

          <Button
            v-if="canWithdrawDispute"
            :label="t('matchConfirmation.withdrawDisputeBtn')"
            icon="fa fa-check"
            severity="success"
            size="small"
            :loading="responding"
            :disabled="responding"
            @click="openResponseDialog('agree')"
          />
        </div>
      </div>
    </div>

    <!-- Response dialog. Inside the panel root so the component stays single-root: the
         parent applies its reveal animation to it, and a hidden panel leaves no gap. -->
    <Dialog
      v-model:visible="responseDialogVisible"
      :header="responseIntent === 'agree' ? acceptDialogTitle : t('matchConfirmation.dialogDisputeTitle')"
      :modal="true"
      :style="{ maxWidth: '480px' }"
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

        <div class="rounded-xl bg-surface-900/50 p-3 text-sm text-white/70">
          <i class="fa fa-info-circle mr-2" aria-hidden="true"></i>
          {{ t('matchConfirmation.disputeHint') }}
        </div>
      </div>

      <div v-else class="text-sm text-white/70">
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
  </SurfacePanel>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type ClientMatchDetail } from '@skol-arena/shared';
import SectionHeader from '@/components/ui/SectionHeader.vue';
import SurfacePanel from '@/components/ui/SurfacePanel.vue';
import { buildConfirmationStatusMap } from '@/composables/match/match-confirmation-status';
import { formatDistanceToNow } from 'date-fns';
import { dateFnsLocaleFor } from '@/utils/DateFnsLocale';

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

const { t, locale } = useI18n();

const responseDialogVisible = ref(false);
const responseIntent = ref<'agree' | 'dispute'>('agree');
const disputeReason = ref('');

// The score used to be repeated here; the hero scoreboard sits directly above, so this
// panel is now only about who has validated and what happens next.
const shouldShowConfirmation = computed(() => {
  return ['reported', 'disputed'].includes(props.match.status);
});

const isDisputed = computed(() => props.match.status === 'disputed');

const confirmations = computed(() =>
  (props.match.confirmations ?? []).filter((c) => !c.isPostFinalization),
);

const participants = computed(() => {
  return props.match.sides.flatMap((side) =>
    side.players.map((p) => ({ playerId: p.id, sidePosition: side.position }))
  );
});

/** Same map the scoreboard paints per player, so the counter can never disagree with it. */
const statusMap = computed(() => buildConfirmationStatusMap(props.match));

const totalPlayers = computed(() => statusMap.value.size);

const confirmedCount = computed(
  () => [...statusMap.value.values()].filter((s) => s === 'confirmed').length,
);

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
    locale: dateFnsLocaleFor(locale.value),
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
  if (mode === 'auto') return 'border-match-win/30 bg-match-win/10 text-match-win'
  if (mode === 'strict') return 'border-blue-400/30 bg-blue-400/10 text-blue-300'
  if (mode === 'admin') return 'border-primary/40 bg-primary/10 text-primary'
  if (mode === 'none') return 'border-amber-400/30 bg-amber-400/10 text-amber-300'
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
  return d.toLocaleDateString(locale.value, {
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
