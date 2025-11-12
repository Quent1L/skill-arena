<template>
  <div class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
    <div class="flex-1">
      <div class="flex items-center gap-3 mb-4">
        <Badge :value="statusLabels[status]" :severity="statusSeverities[status]" />
        <Badge :value="modeLabels[mode]" severity="info" class="bg-blue-100 text-blue-800" />
      </div>

      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {{ name }}
      </h1>

      <p v-if="description" class="text-gray-600 dark:text-gray-400">
        {{ description }}
      </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <div v-if="isAuthenticated">
        <Button
          v-if="!isParticipant && canJoin"
          label="Participer"
          icon="fa fa-user-plus"
          @click="$emit('join')"
          :loading="joining"
          class="bg-green-600 hover:bg-green-700"
        />

        <Button
          v-else-if="isParticipant && canLeave"
          label="Quitter"
          icon="fa fa-user-minus"
          severity="secondary"
          outlined
          @click="$emit('leave')"
          :loading="leaving"
        />

        <div v-else-if="isParticipant" class="flex items-center gap-2 text-green-600">
          <i class="fa fa-check-circle"></i>
          <span class="font-medium">Déjà inscrit</span>
        </div>
      </div>

      <Button
        v-if="canCreateMatch"
        label="Créer un match"
        icon="fa fa-plus"
        @click="$emit('create-match')"
        class="bg-blue-600 hover:bg-blue-700"
      />

      <Button
        v-if="canManage"
        label="Modifier"
        icon="fa fa-pencil"
        outlined
        @click="$emit('edit')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TournamentStatus, TournamentMode } from '@skill-arena/shared'

interface Props {
  name: string
  description?: string
  status: TournamentStatus
  mode: TournamentMode
  isAuthenticated: boolean
  isParticipant: boolean
  canJoin: boolean
  canLeave: boolean
  canCreateMatch: boolean
  canManage: boolean
  joining?: boolean
  leaving?: boolean
}

defineProps<Props>()

defineEmits<{
  join: []
  leave: []
  'create-match': []
  edit: []
}>()

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
</script>
