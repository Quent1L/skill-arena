<template>
  <div class="bracket-view">
    <!-- Wrong Tournament Type Guard -->
    <div
      v-if="!isBracketTournament"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <i class="fa fa-exclamation-triangle text-6xl text-orange-400 mb-4" />
      <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Tournoi non compatible bracket
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        Ce tournoi n'est pas configuré en mode bracket.
      </p>
    </div>

    <template v-else>
      <!-- Avertissement nombre de participants non optimal -->
      <div
        v-if="currentParticipants > 0 && !isOptimalCount"
        class="mb-4 px-4 py-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2"
      >
        <i class="fa fa-exclamation-triangle mt-0.5 shrink-0" />
        <span>
          Pour un bracket optimal, il faut
          <strong>{{ nearestPowersOf2(currentParticipants)[0] }}</strong> ou
          <strong>{{ nearestPowersOf2(currentParticipants)[1] }}</strong>
          joueurs. Actuellement <strong>{{ currentParticipants }}</strong> inscrits —
          la génération du bracket est bloquée.
        </span>
      </div>

      <!-- Admin Controls -->
      <div v-if="canManage" class="mb-6 flex gap-3 items-center flex-wrap">
      <Button
        v-if="!hasBracket"
        label="Générer le bracket"
        icon="fa fa-sitemap"
        :disabled="!isOptimalCount"
        @click="showGenerateDialog = true"
      />

      <template v-else>
        <Button
          label="Regénérer"
          icon="fa fa-redo"
          severity="warning"
          outlined
          @click="handleRegenerate"
        />
        <Button
          label="Supprimer le bracket"
          icon="fa fa-trash"
          severity="danger"
          outlined
          @click="confirmDelete"
        />
      </template>

      <Button
        label="Actualiser"
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
        Aucun bracket généré
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        Le bracket du tournoi n'a pas encore été créé.
        <template v-if="canManage">
          Cliquez sur le bouton ci-dessous pour générer le bracket.
        </template>
        <template v-else>
          Un administrateur doit générer le bracket.
        </template>
      </p>

      <Button
        v-if="canManage"
        label="Générer le bracket"
        icon="fa fa-sitemap"
        size="large"
        :disabled="!isOptimalCount"
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
            <div class="text-gray-600 dark:text-gray-400">Classement</div>
            <div class="font-semibold capitalize">
              {{ bracketData.config.seedingType.replace('_', ' ') }}
            </div>
          </div>
          <div>
            <div class="text-gray-600 dark:text-gray-400">Participants</div>
            <div class="font-semibold">{{ bracketData.config.totalParticipants }}</div>
          </div>
          <div>
            <div class="text-gray-600 dark:text-gray-400">Tours</div>
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
        header="Supprimer le bracket"
        :modal="true"
        :style="{ width: '450px' }"
      >
      <div class="flex items-start gap-4">
        <i class="fa fa-exclamation-triangle text-4xl text-orange-500" />
        <div>
          <p class="mb-3">
            Êtes-vous sûr de vouloir supprimer le bracket ? Cela supprimera tous les matchs et ne peut pas être annulé.
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Vous pouvez regénérer le bracket ensuite si nécessaire.
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Annuler" severity="secondary" @click="showDeleteDialog = false" />
          <Button
            label="Supprimer"
            severity="danger"
            :loading="deleting"
            @click="handleDeleteBracket"
          />
        </div>
      </template>
    </Dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

function nearestPowersOf2(n: number): [number, number] {
  if (n <= 1) return [1, 2]
  const lower = Math.pow(2, Math.floor(Math.log2(n)))
  const upper = lower === n ? n : lower * 2
  return [lower, upper]
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}
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
  currentParticipants,
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

const isOptimalCount = computed(() =>
  currentParticipants.value >= 2 && isPowerOf2(currentParticipants.value)
)

const isBracketTournament = computed(() => {
  return props.tournament?.mode === 'bracket'
})

onMounted(async () => {
  // Only load bracket data if this is a bracket tournament
  if (isBracketTournament.value) {
    await loadBracketData()
  }
})

async function loadBracketData() {
  try {
    await loadBracket(props.tournamentId)
    await checkCanGenerate(props.tournamentId)
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

}
</style>
