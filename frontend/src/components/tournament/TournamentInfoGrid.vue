<template>
  <div>
    <div class="md:hidden mb-4">
      <Button
        :label="showDetails ? 'Masquer les détails' : 'Voir les détails'"
        :icon="showDetails ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"
        @click="showDetails = !showDetails"
        text
        class="w-full"
      />
    </div>

    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      :class="{ 'hidden md:grid': !showDetails }"
    >
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Informations générales</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Mode :</span>
            <span class="font-medium">{{ modeLabels[mode] }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Mode équipe :</span>
            <span class="font-medium">{{ teamModeLabels[teamMode] }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Taille équipe :</span>
            <span class="font-medium">{{ minTeamSize }}-{{ maxTeamSize }} joueurs</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Participants :</span>
            <span class="font-medium">{{ participantCount }} inscrits</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Calendrier</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Début :</span>
            <span class="font-medium">{{ formatDate(startDate) }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Fin :</span>
            <span class="font-medium">{{ formatDate(endDate) }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Durée :</span>
            <span class="font-medium">{{ duration }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Système de points</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Victoire :</span>
            <span class="font-medium">{{ pointPerVictory }} pts</span>
          </div>

          <div v-if="allowDraw" class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Match nul :</span>
            <span class="font-medium">{{ pointPerDraw }} pts</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Défaite :</span>
            <span class="font-medium">{{ pointPerLoss }} pts</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Match nuls :</span>
            <span class="font-medium">{{ allowDraw ? 'Autorisés' : 'Interdits' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDate } from '@/utils/DateUtils'
import type { TournamentMode, TeamMode } from '@skill-arena/shared'

interface Props {
  mode: TournamentMode
  teamMode: TeamMode
  minTeamSize: number
  maxTeamSize: number
  participantCount: number
  startDate: Date | string
  endDate: Date | string
  duration: string
  pointPerVictory: number
  pointPerDraw: number
  pointPerLoss: number
  allowDraw: boolean
}

defineProps<Props>()

const showDetails = ref(false)

const modeLabels: Record<TournamentMode, string> = {
  championship: 'Championnat',
  bracket: 'Bracket',
}

const teamModeLabels: Record<TeamMode, string> = {
  static: 'Statique',
  flex: 'Flexible',
}
</script>
