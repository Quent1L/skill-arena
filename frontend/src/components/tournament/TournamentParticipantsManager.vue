<template>
  <div>
    <!-- Admin Actions -->
    <div v-if="canManage" class="mb-4 flex justify-end">
      <Button
        label="Ajouter un participant"
        icon="fa fa-plus"
        @click="showAddDialog = true"
      />
    </div>

    <!-- Participants List -->
    <div v-if="loading" class="flex justify-center py-8">
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
        <Avatar :label="participant.user.displayName.charAt(0).toUpperCase()" class="bg-blue-500" />
        <div class="flex-1">
          <div class="font-medium text-gray-900 dark:text-white">
            {{ participant.user.displayName }}
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Inscrit le {{ formatDate(participant.joinedAt) }}
          </div>
        </div>
        <div v-if="participant.matchesPlayed > 0" class="text-sm text-gray-500 mr-2">
          {{ participant.matchesPlayed }} matchs
        </div>
        <Button
          v-if="canManage"
          icon="fa fa-trash"
          severity="danger"
          text
          rounded
          @click="confirmRemove(participant)"
          v-tooltip.top="'Retirer du tournoi'"
        />
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
      Aucun participant pour le moment
    </div>

    <!-- Add Participant Dialog -->
    <Dialog
      v-model:visible="showAddDialog"
      header="Ajouter un participant"
      :modal="true"
      :closable="true"
      class="w-full max-w-md"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">Rechercher un utilisateur</label>
          <AutoComplete
            v-model="selectedUser"
            :suggestions="userSuggestions"
            @complete="searchUsers"
            optionLabel="displayName"
            placeholder="Tapez un nom..."
            class="w-full"
            :minLength="2"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <Avatar :label="option.displayName.charAt(0).toUpperCase()" size="small" />
                <span>{{ option.displayName }}</span>
              </div>
            </template>
          </AutoComplete>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" text @click="showAddDialog = false" />
        <Button
          label="Ajouter"
          icon="fa fa-check"
          :loading="adding"
          :disabled="!selectedUser"
          @click="handleAddParticipant"
        />
      </template>
    </Dialog>

    <!-- Confirm Remove Dialog -->
    <Dialog
      v-model:visible="showRemoveDialog"
      header="Confirmer le retrait"
      :modal="true"
      :closable="true"
      class="w-full max-w-sm"
    >
      <p class="text-gray-600 dark:text-gray-400">
        Êtes-vous sûr de vouloir retirer
        <strong>{{ participantToRemove?.user.displayName }}</strong>
        du tournoi ?
      </p>

      <template #footer>
        <Button label="Annuler" text @click="showRemoveDialog = false" />
        <Button
          label="Retirer"
          icon="fa fa-trash"
          severity="danger"
          :loading="removing"
          @click="handleRemoveParticipant"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDate } from '@/utils/DateUtils'
import { useParticipantService } from '@/composables/participant.service'
import type { ParticipantListItem } from '@skill-arena/shared'
import type { UserSearchResult } from '@/composables/participant.api'

interface Props {
  tournamentId: string
  participants: ParticipantListItem[]
  loading?: boolean
  canManage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  canManage: false,
})

const emit = defineEmits<{
  (e: 'participantAdded'): void
  (e: 'participantRemoved'): void
}>()

const {
  searchUsers: searchUsersApi,
  addParticipantAndReload,
  removeParticipantAndReload,
} = useParticipantService()

const showAddDialog = ref(false)
const showRemoveDialog = ref(false)
const selectedUser = ref<UserSearchResult | null>(null)
const userSuggestions = ref<UserSearchResult[]>([])
const participantToRemove = ref<ParticipantListItem | null>(null)
const adding = ref(false)
const removing = ref(false)

async function searchUsers(event: { query: string }) {
  if (event.query.length < 2) {
    userSuggestions.value = []
    return
  }

  const results = await searchUsersApi(event.query)

  // Filter out users already in the tournament
  const existingUserIds = new Set(props.participants.map((p) => p.userId))
  userSuggestions.value = results.filter((u) => !existingUserIds.has(u.id))
}

async function handleAddParticipant() {
  if (!selectedUser.value) return

  adding.value = true
  try {
    const success = await addParticipantAndReload(props.tournamentId, selectedUser.value.id)
    if (success) {
      showAddDialog.value = false
      selectedUser.value = null
      emit('participantAdded')
    }
  } finally {
    adding.value = false
  }
}

function confirmRemove(participant: ParticipantListItem) {
  participantToRemove.value = participant
  showRemoveDialog.value = true
}

async function handleRemoveParticipant() {
  if (!participantToRemove.value) return

  removing.value = true
  try {
    const success = await removeParticipantAndReload(
      props.tournamentId,
      participantToRemove.value.userId,
    )
    if (success) {
      showRemoveDialog.value = false
      participantToRemove.value = null
      emit('participantRemoved')
    }
  } finally {
    removing.value = false
  }
}
</script>
