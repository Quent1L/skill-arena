<template>
  <div>
    <div v-if="canAddParticipants" class="mb-4 flex justify-end">
      <Button
        label="Ajouter un participant"
        icon="fa fa-user-plus"
        @click="showAddParticipantDialog = true"
        size="small"
      />
    </div>

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
        <div v-if="participant.matchesPlayed > 0" class="text-sm text-gray-500">
          {{ participant.matchesPlayed }} matchs
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
      Aucun participant pour le moment
    </div>

    <Dialog
      v-model:visible="showAddParticipantDialog"
      header="Ajouter des participants"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div class="flex flex-col gap-4">
        <div v-if="loadingUsers" class="flex justify-center py-4">
          <ProgressSpinner />
        </div>
        <div v-else>
          <label class="block text-sm font-medium mb-2">Sélectionner un utilisateur</label>
          <Select
            v-model="selectedUserId"
            :options="availableUsers"
            option-label="displayName"
            option-value="id"
            placeholder="Choisir un utilisateur"
            class="w-full"
            filter
          />
        </div>
      </div>
      <template #footer>
        <Button
          label="Annuler"
          severity="secondary"
          @click="showAddParticipantDialog = false"
        />
        <Button
          label="Ajouter"
          icon="fa fa-check"
          @click="handleAddParticipant"
          :disabled="!selectedUserId"
          :loading="addingParticipant"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatDate } from '@/utils/DateUtils'
import type { ParticipantListItem } from '@skill-arena/shared'
import { useAuth } from '@/composables/useAuth'
import { useUserService } from '@/composables/user/user.service'
import { useParticipantService } from '@/composables/participant.service'

interface Props {
  participants: ParticipantListItem[]
  loading?: boolean
  tournamentId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  participantAdded: []
}>()

const { isAdmin } = useAuth()
const { users, loading: loadingUsers, listUsers } = useUserService()
const participantService = useParticipantService()

const showAddParticipantDialog = ref(false)
const selectedUserId = ref<string | null>(null)
const addingParticipant = ref(false)

const canAddParticipants = computed(() => isAdmin.value)

const participantUserIds = computed(() => props.participants.map((p) => p.userId))

const availableUsers = computed(() => {
  return users.value.filter((user) => !participantUserIds.value.includes(user.id))
})

watch(showAddParticipantDialog, async (visible) => {
  if (visible && users.value.length === 0) {
    await listUsers()
  }
})

async function handleAddParticipant() {
  if (!selectedUserId.value) return

  addingParticipant.value = true
  try {
    const success = await participantService.adminAddParticipantAndReload(
      props.tournamentId,
      selectedUserId.value,
    )
    if (success) {
      showAddParticipantDialog.value = false
      selectedUserId.value = null
      emit('participantAdded')
    }
  } finally {
    addingParticipant.value = false
  }
}
</script>
