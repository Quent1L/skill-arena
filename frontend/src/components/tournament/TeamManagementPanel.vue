<template>
  <div class="p-4 space-y-4">
    <Message v-if="isLocked" severity="warn" :closable="false">
      Les équipes sont verrouillées (tournoi en cours ou terminé).
    </Message>

    <Message
      v-if="!isLocked && props.isParticipant && isAlreadyInTeam"
      severity="info"
      :closable="false"
    >
      Vous êtes déjà membre d'une équipe pour ce tournoi.
    </Message>

    <!-- Create team form -->
    <div v-if="canCreate && !isLocked" class="flex gap-2">
      <InputText
        v-model="newTeamName"
        placeholder="Nom de l'équipe"
        class="flex-1"
        maxlength="50"
        @keyup.enter="handleCreate"
      />
      <Button
        label="Créer"
        icon="fa fa-plus"
        :loading="loading"
        :disabled="!newTeamName.trim()"
        @click="handleCreate"
      />
    </div>

    <div v-if="loading && !teams.length" class="flex justify-center py-8">
      <ProgressSpinner />
    </div>

    <div v-else-if="!teams.length" class="text-center py-8 text-gray-500 dark:text-gray-400">
      Aucune équipe créée pour ce tournoi.
    </div>

    <div v-else class="space-y-3">
      <Card
        v-for="team in teams"
        :key="team.id"
        class="border border-gray-200 dark:border-gray-700"
      >
        <template #content>
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="font-semibold text-gray-900 dark:text-gray-100">{{ team.name }}</span>
                <Badge :value="team.members.length" severity="info" size="small" />
                <i
                  v-if="team.hasMatch"
                  class="fa fa-lock text-xs text-gray-400"
                  title="Équipe verrouillée (Un ou plusieurs matchs ont déjà été saisies)"
                />
              </div>
              <div class="flex flex-wrap gap-1">
                <Tag
                  v-for="member in team.members"
                  :key="member.id"
                  :value="member.user.displayName"
                  severity="secondary"
                  class="text-xs"
                />
                <span v-if="!team.members.length" class="text-xs text-gray-400 italic"
                  >Aucun membre</span
                >
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <!-- Admin: add player button -->
              <Button
                v-if="props.canManage && !isTeamLocked(team)"
                icon="fa fa-user-plus"
                size="small"
                severity="info"
                outlined
                :loading="loading"
                @click="openAddPlayerDialog(team)"
              />
              <!-- Join button -->
              <Button
                v-if="canJoinTeam(team) && !isTeamLocked(team)"
                label="Rejoindre"
                icon="fa fa-sign-in"
                size="small"
                severity="success"
                outlined
                :loading="loading"
                @click="handleJoin(team.id)"
              />
              <!-- Leave button -->
              <Button
                v-if="isMemberOf(team) && !isTeamLocked(team)"
                label="Quitter"
                icon="fa fa-sign-out"
                size="small"
                severity="warning"
                outlined
                :loading="loading"
                @click="handleLeave(team.id)"
              />
              <!-- Delete button -->
              <Button
                v-if="canDelete(team)"
                icon="fa fa-trash"
                size="small"
                severity="danger"
                outlined
                :loading="loading"
                @click="handleDelete(team.id)"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Admin: add player dialog -->
    <Dialog
      v-model:visible="addPlayerDialogVisible"
      modal
      header="Ajouter un joueur"
      :style="{ width: '24rem' }"
    >
      <div class="flex flex-col gap-4">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          Sélectionnez un participant à ajouter dans
          <strong>{{ targetTeam?.name }}</strong
          >.
        </span>
        <Select
          v-model="selectedUserId"
          :options="availableParticipants"
          option-label="label"
          option-value="value"
          placeholder="Choisir un joueur…"
          class="w-full"
          filter
        />
      </div>
      <template #footer>
        <Button
          label="Annuler"
          severity="secondary"
          outlined
          @click="addPlayerDialogVisible = false"
        />
        <Button
          label="Ajouter"
          icon="fa fa-user-plus"
          :disabled="!selectedUserId"
          :loading="loading"
          @click="handleAdminAddPlayer"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTeamService } from '@/composables/team/team.service'
import { participantApi } from '@/composables/participant.api'
import { onWsEvent, sendWsMessage } from '@/composables/notification/notification.socket'
import type { ClientTeam } from '@skill-arena/shared/types/index'
import type { ParticipantListItem } from '@skill-arena/shared/types/index'

const props = defineProps<{
  tournamentId: string
  currentUserId?: string
  isParticipant: boolean
  canManage: boolean
  tournamentStatus?: string
}>()

const { teams, loading, loadTeams, createTeam, joinTeam, leaveTeam, deleteTeam } = useTeamService()
const newTeamName = ref('')

const isLocked = computed(
  () => props.tournamentStatus === 'ongoing' || props.tournamentStatus === 'finished',
)

const isAlreadyInTeam = computed(() => !props.canManage && userCurrentTeamId.value !== null)
const canCreate = computed(() => props.canManage || (props.isParticipant && !isAlreadyInTeam.value))

const userCurrentTeamId = computed(() => {
  if (!props.currentUserId) return null
  const team = teams.value.find((t) => t.members.some((m) => m.userId === props.currentUserId))
  return team?.id ?? null
})

// Add player dialog state
const addPlayerDialogVisible = ref(false)
const targetTeam = ref<ClientTeam | null>(null)
const selectedUserId = ref<string | null>(null)
const participants = ref<ParticipantListItem[]>([])

const availableParticipants = computed(() => {
  if (!targetTeam.value) return []
  const memberIds = new Set(targetTeam.value.members.map((m) => m.userId))
  return participants.value
    .filter((p) => !memberIds.has(p.userId))
    .map((p) => ({ label: p.user.displayName, value: p.userId }))
})

function openAddPlayerDialog(team: ClientTeam) {
  targetTeam.value = team
  selectedUserId.value = null
  addPlayerDialogVisible.value = true
}

async function handleAdminAddPlayer() {
  if (!targetTeam.value || !selectedUserId.value) return
  await joinTeam(props.tournamentId, targetTeam.value.id, selectedUserId.value)
  addPlayerDialogVisible.value = false
}

function isMemberOf(team: ClientTeam): boolean {
  if (!props.currentUserId) return false
  return team.members.some((m) => m.userId === props.currentUserId)
}

function canJoinTeam(team: ClientTeam): boolean {
  if (!props.currentUserId) return false
  if (!props.isParticipant && !props.canManage) return false
  if (userCurrentTeamId.value !== null) return false
  return !isMemberOf(team)
}

function isTeamLocked(team: ClientTeam): boolean {
  return isLocked.value || team.hasMatch
}

function canDelete(team: ClientTeam): boolean {
  if (isLocked.value) return false
  // Hide delete if user is the sole member (leave auto-deletes)
  if (isMemberOf(team) && team.members.length === 1) return false
  if (!props.currentUserId) return false
  return props.canManage || team.createdBy === props.currentUserId
}

async function handleCreate() {
  if (!newTeamName.value.trim()) return
  await createTeam(props.tournamentId, newTeamName.value.trim())
  newTeamName.value = ''
}

async function handleJoin(teamId: string) {
  await joinTeam(props.tournamentId, teamId)
}

async function handleLeave(teamId: string) {
  await leaveTeam(props.tournamentId, teamId)
}

async function handleDelete(teamId: string) {
  await deleteTeam(props.tournamentId, teamId)
}

const offCreated = ref<(() => void) | null>(null)
const offUpdated = ref<(() => void) | null>(null)
const offDeleted = ref<(() => void) | null>(null)

onMounted(async () => {
  await loadTeams(props.tournamentId)

  if (props.canManage) {
    participants.value = await participantApi.getTournamentParticipants(props.tournamentId)
  }

  sendWsMessage({ event: 'subscribe_tournament', tournamentId: props.tournamentId })

  offCreated.value = onWsEvent('team_created', (data) => {
    const team = data as ClientTeam
    if (!teams.value.find((t) => t.id === team.id)) {
      teams.value.push(team)
    }
  })

  offUpdated.value = onWsEvent('team_updated', (data) => {
    const team = data as ClientTeam
    const idx = teams.value.findIndex((t) => t.id === team.id)
    if (idx !== -1) teams.value[idx] = team
  })

  offDeleted.value = onWsEvent('team_deleted', (data) => {
    const { teamId } = data as { teamId: string }
    teams.value = teams.value.filter((t) => t.id !== teamId)
  })
})

onUnmounted(() => {
  sendWsMessage({ event: 'unsubscribe_tournament', tournamentId: props.tournamentId })
  offCreated.value?.()
  offUpdated.value?.()
  offDeleted.value?.()
})
</script>
