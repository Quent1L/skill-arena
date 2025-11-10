<template>
  <div class="tournament-detail-view">
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- Error -->
    <Message v-else-if="error" severity="error" class="mb-6">
      {{ error }}
    </Message>

    <!-- Tournament Details -->
    <div v-else-if="tournament" class="space-y-6">
      <!-- Header with actions -->
      <Card>
        <template #header>
          <div class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 p-6 pb-0">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-4">
                <Badge
                  :value="statusLabels[tournament.status]"
                  :severity="statusSeverities[tournament.status]"
                />
                <Badge
                  :value="modeLabels[tournament.mode]"
                  severity="info"
                  class="bg-blue-100 text-blue-800"
                />
              </div>

              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {{ tournament.name }}
              </h1>

              <p v-if="tournament.description" class="text-gray-600 dark:text-gray-400">
                {{ tournament.description }}
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <!-- Bouton de participation -->
              <div v-if="isAuthenticated">
                <Button
                  v-if="!isParticipant && canJoinTournament"
                  label="Participer"
                  icon="fa fa-user-plus"
                  @click="joinTournament"
                  :loading="joining"
                  class="bg-green-600 hover:bg-green-700"
                />

                <Button
                  v-else-if="isParticipant && canLeaveTournament"
                  label="Quitter"
                  icon="fa fa-user-minus"
                  severity="secondary"
                  outlined
                  @click="leaveTournament"
                  :loading="leaving"
                />

                <div v-else-if="isParticipant" class="flex items-center gap-2 text-green-600">
                  <i class="fa fa-check-circle"></i>
                  <span class="font-medium">Déjà inscrit</span>
                </div>
              </div>

              <!-- Bouton admin -->
              <Button
                v-if="canManageTournament"
                label="Modifier"
                icon="fa fa-pencil"
                outlined
                @click="editTournament"
              />
            </div>
          </div>
        </template>

        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Informations générales -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Informations générales
              </h3>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Mode :</span>
                  <span class="font-medium">{{ modeLabels[tournament.mode] }}</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Mode équipe :</span>
                  <span class="font-medium">{{ teamModeLabels[tournament.teamMode] }}</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Taille équipe :</span>
                  <span class="font-medium"
                    >{{ tournament.minTeamSize }}-{{ tournament.maxTeamSize }} joueurs</span
                  >
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Participants :</span>
                  <span class="font-medium">{{ participantCount }} inscrits</span>
                </div>
              </div>
            </div>

            <!-- Dates -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Calendrier</h3>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Début :</span>
                  <span class="font-medium">{{ formatDate(tournament.startDate) }}</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Fin :</span>
                  <span class="font-medium">{{ formatDate(tournament.endDate) }}</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Durée :</span>
                  <span class="font-medium">{{ tournamentDuration }}</span>
                </div>
              </div>
            </div>

            <!-- Système de points -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Système de points</h3>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Victoire :</span>
                  <span class="font-medium">{{ tournament.pointPerVictory }} pts</span>
                </div>

                <div v-if="tournament.allowDraw" class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Match nul :</span>
                  <span class="font-medium">{{ tournament.pointPerDraw }} pts</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Défaite :</span>
                  <span class="font-medium">{{ tournament.pointPerLoss }} pts</span>
                </div>

                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Match nuls :</span>
                  <span class="font-medium">{{
                    tournament.allowDraw ? 'Autorisés' : 'Interdits'
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Participants -->
      <Card>
        <template #header>
          <div class="p-6 pb-0">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              Participants ({{ participantCount }})
            </h2>
          </div>
        </template>

        <template #content>
          <div v-if="loadingParticipants" class="flex justify-center py-8">
            <ProgressSpinner />
          </div>

          <div
            v-else-if="participants.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div
              v-for="participant in participants"
              :key="participant.id"
              class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <Avatar
                :label="participant.user.displayName.charAt(0).toUpperCase()"
                class="bg-blue-500"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ participant.user.displayName }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  Inscrit le {{ formatDate(participant.joinedAt) }}
                </div>
              </div>
              <div v-if="participant.matchesPlayed > 0" class="text-sm text-gray-500">
                {{ participant.matchesPlayed }} matchs
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            Aucun participant pour le moment
          </div>
        </template>
      </Card>
    </div>

    <!-- Tournament not found -->
    <Card v-else class="text-center py-12">
      <template #content>
        <div class="space-y-4">
          <i class="pi pi-exclamation-triangle text-4xl text-orange-400"></i>
          <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Tournoi introuvable
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            Le tournoi que vous cherchez n'existe pas ou n'est plus disponible.
          </p>
          <div>
            <Button label="Retour aux tournois" @click="router.push('/')" class="text-blue-600" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTournamentService } from '@/composables/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import { formatDate, calculateDuration } from '@/utils/DateUtils'
import type {
  BaseTournament,
  TournamentStatus,
  TournamentMode,
  TeamMode,
} from '@skill-arena/shared'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, isSuperAdmin, appUser } = useAuth()
const { getTournament } = useTournamentService()
const {
  participants,
  joinTournament: joinTournamentAction,
  leaveTournament: leaveTournamentAction,
  getTournamentParticipants,
} = useParticipantService()

// State
const tournament = ref<BaseTournament | null>(null)
const loading = ref(true)
const loadingParticipants = ref(true)
const error = ref<string | null>(null)
const joining = ref(false)
const leaving = ref(false)

// Computed
const tournamentId = computed(() => route.params.id as string)

const isParticipant = computed(() => {
  if (!isAuthenticated.value || !appUser.value || !participants.value.length) return false
  return participants.value.some((p) => p.userId === appUser.value?.id)
})

const canJoinTournament = computed(() => {
  if (!tournament.value) return false
  return ['open', 'ongoing'].includes(tournament.value.status)
})

const canLeaveTournament = computed(() => {
  if (!tournament.value) return false
  return !['ongoing', 'finished'].includes(tournament.value.status)
})

const canManageTournament = computed(() => {
  return isAuthenticated.value && isSuperAdmin.value
})

const participantCount = computed(() => participants.value.length)

const tournamentDuration = computed(() => {
  if (!tournament.value) return ''
  return calculateDuration(tournament.value.startDate, tournament.value.endDate)
})

// Labels
const statusLabels: Record<TournamentStatus, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  ongoing: 'En cours',
  finished: 'Terminé',
}

const statusSeverities: Record<TournamentStatus, 'secondary' | 'success' | 'warn' | 'info'> = {
  draft: 'secondary',
  open: 'success',
  ongoing: 'warn',
  finished: 'info',
}

const modeLabels: Record<TournamentMode, string> = {
  championship: 'Championnat',
  bracket: 'Bracket',
}

const teamModeLabels: Record<TeamMode, string> = {
  static: 'Statique',
  flex: 'Flexible',
}

// Methods
async function loadTournament() {
  try {
    loading.value = true
    error.value = null

    const result = await getTournament(tournamentId.value)
    tournament.value = result
  } catch (err) {
    console.error('Erreur lors du chargement du tournoi:', err)
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du tournoi'
  } finally {
    loading.value = false
  }
}

async function loadParticipants() {
  try {
    loadingParticipants.value = true
    await getTournamentParticipants(tournamentId.value)
  } catch (err) {
    console.error('Erreur lors du chargement des participants:', err)
  } finally {
    loadingParticipants.value = false
  }
}

async function joinTournament() {
  try {
    joining.value = true
    const result = await joinTournamentAction(tournamentId.value)
    if (result) {
      await loadParticipants()
    }
  } catch (err) {
    console.error("Erreur lors de l'inscription:", err)
  } finally {
    joining.value = false
  }
}

async function leaveTournament() {
  try {
    leaving.value = true
    const success = await leaveTournamentAction(tournamentId.value)
    if (success) {
      await loadParticipants()
    }
  } catch (err) {
    console.error('Erreur lors de la désinscription:', err)
  } finally {
    leaving.value = false
  }
}

function editTournament() {
  router.push(`/admin/tournaments/${tournamentId.value}/edit`)
}

// Lifecycle
onMounted(async () => {
  await loadTournament()
  if (tournament.value) {
    await loadParticipants()
  }
})
</script>

<style scoped>
.tournament-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .tournament-detail-view {
    padding: 1rem;
  }
}
</style>
