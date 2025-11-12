<template>
  <div>
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
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '@/utils/DateUtils'
import type { ParticipantListItem } from '@skill-arena/shared'

interface Props {
  participants: ParticipantListItem[]
  loading?: boolean
}

defineProps<Props>()
</script>
