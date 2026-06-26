<template>
  <div>
    <div>
      <Button
        :label="showDetails ? t('tournamentInfoGrid.hideDetails') : t('tournamentInfoGrid.showDetails')"
        :icon="showDetails ? 'fa fa-chevron-up' : 'fa fa-chevron-down'"
        @click="showDetails = !showDetails"
        text
        class="w-full"
      />
    </div>

    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4"
      :class="{ 'hidden': !showDetails }"
    >
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('tournamentInfoGrid.generalInfo') }}</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.modeLabel') }}</span>
            <span class="font-medium">{{ modeLabels[mode] }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.teamModeLabel') }}</span>
            <span class="font-medium">{{ teamModeLabels[teamMode] }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.teamSizeLabel') }}</span>
            <span class="font-medium">{{ minTeamSize }}-{{ maxTeamSize }} {{ t('tournamentInfoGrid.playersUnit') }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('tournamentInfoGrid.schedule') }}</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.startLabel') }}</span>
            <span class="font-medium">{{ formatDate(startDate) }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.endLabel') }}</span>
            <span class="font-medium">{{ formatDate(endDate) }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.durationLabel') }}</span>
            <span class="font-medium">{{ duration }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('tournamentInfoGrid.pointSystem') }}</h3>

        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.victoryLabel') }}</span>
            <span class="font-medium">{{ pointPerVictory }} {{ t('tournamentInfoGrid.ptsUnit') }}</span>
          </div>

          <div v-if="allowDraw" class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.drawLabel') }}</span>
            <span class="font-medium">{{ pointPerDraw }} {{ t('tournamentInfoGrid.ptsUnit') }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.lossLabel') }}</span>
            <span class="font-medium">{{ pointPerLoss }} {{ t('tournamentInfoGrid.ptsUnit') }}</span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">{{ t('tournamentInfoGrid.drawsAllowedLabel') }}</span>
            <span class="font-medium">{{ allowDraw ? t('tournamentInfoGrid.allowed') : t('tournamentInfoGrid.forbidden') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '@/utils/DateUtils'
import type { TournamentMode, TeamMode } from '@skol-arena/shared'

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

const { t } = useI18n()

const showDetails = ref(false)

const modeLabels = computed<Record<TournamentMode, string>>(() => ({
  championship: t('tournamentInfoGrid.modeChampionship'),
  bracket: t('tournamentInfoGrid.modeBracket'),
  ranked: t('tournamentInfoGrid.modeRanked'),
}))

const teamModeLabels = computed<Record<TeamMode, string>>(() => ({
  static: t('tournamentInfoGrid.teamModeStatic'),
  flex: t('tournamentInfoGrid.teamModeFlex'),
}))
</script>
