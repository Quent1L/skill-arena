<template>
  <Card v-if="shouldShowConfirmation" class="match-confirmation">
    <template #header>
      <div class="flex items-center gap-3">
        <i class="fa fa-check-circle text-2xl text-primary"></i>
        <h3 class="text-xl font-semibold">Confirmation du résultat</h3>
      </div>
    </template>
    
    <template #content>
      <div class="space-y-4">
        <!-- Infos de saisie -->
        <div class="bg-surface-50 dark:bg-surface-800 p-3 rounded-lg text-center text-sm text-surface-500 dark:text-surface-400">
          <p>
            Résultat saisi par 
            <span class="font-semibold">{{ match.reporter?.displayName || 'Inconnu' }}</span>
            le {{ formatDate(match.reportedAt) }}
          </p>
        </div>

        <!-- Statut des confirmations -->
        <div v-if="confirmations && confirmations.length > 0" class="space-y-3">
          <h4 class="font-semibold text-surface-700 dark:text-surface-300">
            Confirmations des joueurs ({{ confirmedCount }}/{{ totalPlayers }})
          </h4>
          
          <div class="space-y-2">
            <div 
              v-for="confirmation in confirmations" 
              :key="confirmation.id"
              class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <i 
                  :class="[
                    'fa text-lg',
                    confirmation.isConfirmed ? 'fa-check-circle text-green-500' :
                    confirmation.isContested ? 'fa-times-circle text-red-500' :
                    'fa-clock text-surface-400'
                  ]"
                ></i>
                <span class="font-medium">
                  {{ confirmation.player?.displayName || 'Joueur inconnu' }}
                </span>
              </div>
              
              <Tag 
                v-if="confirmation.isConfirmed"
                severity="success"
                value="Confirmé"
              />
              <Tag 
                v-else-if="confirmation.isContested"
                severity="danger"
                value="Contesté"
              />
              <Tag 
                v-else
                severity="warn"
                value="En attente"
              />
            </div>
          </div>
        </div>

        <!-- Deadline -->
        <div v-if="match.confirmationDeadline" class="p-3 bg-warn-50 dark:bg-warn-900/20 rounded-lg">
          <div class="flex items-center gap-2 text-sm">
            <i class="fa fa-clock text-warn-600 dark:text-warn-400"></i>
            <span class="text-surface-700 dark:text-surface-300">
              Deadline de confirmation : {{ formatDate(match.confirmationDeadline) }}
              <span v-if="!isExpired" class="text-warn-600 dark:text-warn-400 font-semibold">
                ({{ timeRemaining }})
              </span>
              <span v-else class="text-red-600 dark:text-red-400 font-semibold">
                (Expirée)
              </span>
            </span>
          </div>
        </div>

        <!-- Actions pour le joueur connecté -->
        <div v-if="canUserConfirm" class="space-y-3">
          <Divider />
          
          <div v-if="!userConfirmation">
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">
              Confirmez-vous ce résultat ?
            </p>
            
            <div class="flex gap-3">
              <Button 
                label="Confirmer"
                icon="fa fa-check"
                severity="success"
                :loading="confirming"
                :disabled="contesting"
                @click="confirmMatch"
                class="flex-1"
              />
              <Button 
                label="Contester"
                icon="fa fa-times"
                severity="danger"
                :loading="contesting"
                :disabled="confirming"
                @click="openContestDialog"
                class="flex-1"
              />
            </div>
          </div>
          
          <div v-else class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <div class="flex items-center gap-2">
              <i 
                :class="[
                  'fa text-lg',
                  userConfirmation.isConfirmed ? 'fa-check-circle text-green-500' :
                  'fa-times-circle text-red-500'
                ]"
              ></i>
              <span class="text-sm text-surface-700 dark:text-surface-300">
                Vous avez {{ userConfirmation.isConfirmed ? 'confirmé' : 'contesté' }} ce résultat
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <!-- Dialog de contestation -->
  <Dialog 
    v-model:visible="contestDialogVisible" 
    header="Contester le résultat"
    :modal="true"
    :style="{ width: '500px' }"
  >
    <div class="space-y-4">
      <div>
        <label for="contestReason" class="block text-sm font-medium mb-2">
          Raison de la contestation (optionnel)
        </label>
        <Textarea 
          id="contestReason"
          v-model="contestReason"
          rows="4"
          placeholder="Expliquez pourquoi vous contestez ce résultat..."
          class="w-full"
        />
      </div>
      
      <div>
        <label for="contestProof" class="block text-sm font-medium mb-2">
          Preuve (lien, description) (optionnel)
        </label>
        <InputText 
          id="contestProof"
          v-model="contestProof"
          placeholder="Lien vers une capture d'écran, vidéo, etc."
          class="w-full"
        />
      </div>
    </div>
    
    <template #footer>
      <Button 
        label="Annuler" 
        severity="secondary"
        @click="contestDialogVisible = false"
      />
      <Button 
        label="Contester" 
        severity="danger"
        icon="fa fa-times"
        :loading="contesting"
        @click="submitContest"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { type ClientMatchModel } from '@skill-arena/shared/types/index';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';
import InputText from 'primevue/inputtext';
import Divider from 'primevue/divider';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  match: ClientMatchModel;
  currentUserId?: string;
  confirming?: boolean;
  contesting?: boolean;
}

interface Emits {
  (event: 'confirm'): void;
  (event: 'contest', data: { reason?: string; proof?: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const contestDialogVisible = ref(false);
const contestReason = ref('');
const contestProof = ref('');

const shouldShowConfirmation = computed(() => {
  return ['reported', 'pending_confirmation', 'disputed'].includes(props.match.status);
});

const confirmations = computed(() => props.match.confirmations || []);

const totalPlayers = computed(() => {
  const participations = props.match.participations || [];
  return participations.length;
});

const confirmedCount = computed(() => {
  return confirmations.value.filter(c => c.isConfirmed).length;
});

const userConfirmation = computed(() => {
  if (!props.currentUserId) return null;
  return confirmations.value.find(c => c.playerId === props.currentUserId);
});

const canUserConfirm = computed(() => {
  if (!props.currentUserId) return false;
  if (props.match.status === 'finalized') return false;
  
  const participations = props.match.participations || [];
  const isParticipant = participations.some(p => p.playerId === props.currentUserId);
  
  return isParticipant;
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

function confirmMatch() {
  emit('confirm');
}

function openContestDialog() {
  contestDialogVisible.value = true;
  contestReason.value = '';
  contestProof.value = '';
}

function submitContest() {
  emit('contest', {
    reason: contestReason.value || undefined,
    proof: contestProof.value || undefined,
  });
  contestDialogVisible.value = false;
}
</script>

<style scoped>
.match-confirmation {
  background: var(--surface-card);
}
</style>

