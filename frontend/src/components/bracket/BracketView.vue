<template>
  <div class="bracket-view">
    <!-- Admin Controls -->
    <div v-if="canManage" class="mb-6 flex gap-3 items-center flex-wrap">
      <Button
        v-if="!hasBracket"
        label="Generate Bracket"
        icon="fa fa-sitemap"
        @click="showGenerateDialog = true"
      />

      <template v-else>
        <Button
          label="Regenerate"
          icon="fa fa-redo"
          severity="warning"
          outlined
          @click="handleRegenerate"
        />
        <Button
          label="Delete Bracket"
          icon="fa fa-trash"
          severity="danger"
          outlined
          @click="confirmDelete"
        />
      </template>

      <Button
        label="Refresh"
        icon="fa fa-sync"
        severity="secondary"
        outlined
        :loading="loading"
        @click="loadBracketData"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading && !bracketData" class="flex justify-center items-center py-20">
      <ProgressSpinner />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!bracketData"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <i class="fa fa-sitemap text-6xl text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        No Bracket Generated
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        The tournament bracket has not been created yet.
        <template v-if="canManage">
          Click the button below to generate the bracket.
        </template>
        <template v-else>
          An administrator needs to generate the bracket.
        </template>
      </p>
      <Button
        v-if="canManage"
        label="Generate Bracket"
        icon="fa fa-sitemap"
        size="large"
        @click="showGenerateDialog = true"
      />
    </div>

    <!-- Bracket Display -->
    <div v-else class="bracket-container">
      <!-- Bracket Info -->
      <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div class="text-gray-600 dark:text-gray-400">Type</div>
            <div class="font-semibold capitalize">
              {{ bracketData.config.bracketType.replace('_', ' ') }}
            </div>
          </div>
          <div>
            <div class="text-gray-600 dark:text-gray-400">Seeding</div>
            <div class="font-semibold capitalize">
              {{ bracketData.config.seedingType.replace('_', ' ') }}
            </div>
          </div>
          <div>
            <div class="text-gray-600 dark:text-gray-400">Participants</div>
            <div class="font-semibold">{{ bracketData.config.totalParticipants }}</div>
          </div>
          <div>
            <div class="text-gray-600 dark:text-gray-400">Rounds</div>
            <div class="font-semibold">{{ bracketData.config.roundsCount }}</div>
          </div>
        </div>
      </div>

      <!-- Tournament Bracket Component -->
      <TournamentBracket :bracket-data="bracketData" />
    </div>

    <!-- Generate/Regenerate Dialog -->
    <GenerateBracketDialog
      v-model="showGenerateDialog"
      :is-regeneration="hasBracket"
      :current-discipline-id="tournament?.disciplineId"
      @submit="handleGenerateSubmit"
    />

    <!-- Delete Confirmation Dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      header="Delete Bracket"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="flex items-start gap-4">
        <i class="fa fa-exclamation-triangle text-4xl text-orange-500" />
        <div>
          <p class="mb-3">
            Are you sure you want to delete the bracket? This will remove all matches and cannot be
            undone.
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            You can regenerate the bracket afterwards if needed.
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" severity="secondary" @click="showDeleteDialog = false" />
          <Button
            label="Delete"
            severity="danger"
            :loading="deleting"
            @click="handleDeleteBracket"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBracketService } from '@/composables/bracket/bracket.service'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import TournamentBracket from '@/components/tournament/TournamentBracket.vue'
import GenerateBracketDialog from './GenerateBracketDialog.vue'
import type { GenerateBracketInput } from '@skill-arena/shared'
import type { TournamentResponse } from '@/composables/tournament/tournament.api'

interface Props {
  tournamentId: string
  tournament?: TournamentResponse
}

const props = defineProps<Props>()

const {
  bracketData,
  loading,
  hasBracket,
  loadBracket,
  generateBracket,
  regenerateBracket,
  deleteBracket,
  checkCanGenerate,
} = useBracketService()

const { canManageTournament } = useTournamentService()

const showGenerateDialog = ref(false)
const showDeleteDialog = ref(false)
const deleting = ref(false)

const canManage = computed(() => {
  return props.tournament ? canManageTournament(props.tournament) : false
})

onMounted(async () => {
  await loadBracketData()
})

async function loadBracketData() {
  try {
    await loadBracket(props.tournamentId)
    if (canManage.value) {
      await checkCanGenerate(props.tournamentId)
    }
  } catch (error) {
    console.error('Failed to load bracket:', error)
  }
}

async function handleGenerateSubmit(input: GenerateBracketInput) {
  try {
    if (hasBracket.value) {
      await regenerateBracket(props.tournamentId, input)
    } else {
      await generateBracket(props.tournamentId, input)
    }
    showGenerateDialog.value = false
  } catch (error) {
    console.error('Failed to generate bracket:', error)
  }
}

function handleRegenerate() {
  showGenerateDialog.value = true
}

function confirmDelete() {
  showDeleteDialog.value = true
}

async function handleDeleteBracket() {
  deleting.value = true
  try {
    await deleteBracket(props.tournamentId)
    showDeleteDialog.value = false
  } catch (error) {
    console.error('Failed to delete bracket:', error)
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.bracket-view {
  width: 100%;
}

.bracket-container {
  width: 100%;
  overflow-x: auto;
}
</style>
