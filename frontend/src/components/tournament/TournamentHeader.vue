<template>
  <div class="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
    <div class="flex-1">
      <div class="flex justify-between">
        <div class="flex items-center gap-3 mb-4">
          <Badge :value="statusLabels[status]" :severity="statusSeverities[status]" />
          <Badge :value="modeLabels[mode]" severity="info" class="bg-blue-100 text-blue-800" />
        </div>

        <div class="flex items-center gap-3">
          <Button
            v-if="isAuthenticated && !isParticipant && canJoin"
            label="Participer"
            icon="fa fa-user-plus"
            @click="$emit('join')"
            :loading="joining"
            class="bg-green-600 hover:bg-green-700"
          />

          <div
            v-if="isAuthenticated && isParticipant && !canLeave"
            class="flex items-center gap-2 text-green-600"
          >
            <i class="fa fa-check-circle"></i>
            <span class="font-medium">Déjà inscrit</span>
          </div>

          <Button
            v-if="canCreateMatch"
            label="Créer un match"
            icon="fa fa-plus"
            @click="emit('create-match')"
            class="bg-blue-600 hover:bg-blue-700 hidden md:flex"
          />
          <OverflowMenuButton :items="items" menu-id="header-menu" />
        </div>
      </div>

      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {{ name }}
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TournamentStatus, TournamentMode } from '@skill-arena/shared'
import type { MenuItem } from 'primevue/menuitem'
import OverflowMenuButton from '@/components/OverflowMenuButton.vue'

interface Props {
  name: string
  status: TournamentStatus
  mode: TournamentMode
  isAuthenticated: boolean
  isParticipant: boolean
  canJoin: boolean
  canLeave: boolean
  canCreateMatch: boolean
  items?: MenuItem[]
  joining?: boolean
  leaving?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  join: []
  leave: []
  'create-match': []
}>()

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouvert',
  ongoing: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
}

const statusSeverities: Record<string, 'secondary' | 'success' | 'warn' | 'info' | 'danger'> = {
  draft: 'secondary',
  open: 'success',
  ongoing: 'warn',
  finished: 'info',
  cancelled: 'danger',
}

const modeLabels: Record<TournamentMode, string> = {
  championship: 'Championnat',
  bracket: 'Bracket',
  ranked: 'Ranked',
}
</script>
