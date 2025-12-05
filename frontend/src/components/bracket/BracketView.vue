<template>
  <div class="bracket-view">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- Error State -->
    <Message v-else-if="error" severity="error" class="mb-4">
      {{ error }}
    </Message>

    <!-- Empty State (no bracket generated) -->
    <div v-else-if="!hasMatches" class="text-center py-12">
      <div class="space-y-4">
        <i class="fa fa-sitemap text-4xl text-gray-400"></i>
        <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">
          Aucun bracket généré
        </h3>
        <p class="text-gray-500 dark:text-gray-400">
          Le bracket n'a pas encore été généré pour ce tournoi.
        </p>

        <!-- Generate Bracket Button (admin only) -->
        <div v-if="canManage" class="pt-4">
          <Button
            label="Générer le bracket"
            icon="fa fa-magic"
            :loading="generating"
            @click="showGenerateDialog = true"
          />
        </div>
      </div>
    </div>

    <!-- Bracket Content -->
    <div v-else>
      <!-- Navigation -->
      <BracketNavigation
        v-model:current-round-index="currentRoundIndex"
        v-model:selected-bracket-type="selectedBracketType"
        :total-rounds="currentRounds.length"
        :current-round-label="currentRoundLabel"
        :is-double-elimination="isDoubleElimination"
      />

      <!-- Swipeable Round Container -->
      <div
        ref="roundContainer"
        class="bracket-round-container mt-6 overflow-x-auto pb-4 snap-x snap-mandatory"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <div class="flex gap-4 px-4" :style="{ minWidth: 'max-content' }">
          <!-- Current Round (mobile: single round, desktop: all visible) -->
          <template v-if="isMobile">
            <BracketRound
              v-if="currentRound"
              :round-number="currentRound.roundNumber"
              :matches="currentRound.matches"
              :round-label="currentRoundLabel"
              class="snap-center"
            />
          </template>
          <template v-else>
            <BracketRound
              v-for="round in currentRounds"
              :key="round.roundNumber"
              :round-number="round.roundNumber"
              :matches="round.matches"
              :round-label="getRoundLabel(round.roundNumber)"
              class="snap-center"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Generate Bracket Dialog -->
    <Dialog
      v-model:visible="showGenerateDialog"
      header="Générer le bracket"
      :modal="true"
      :closable="true"
      class="w-full max-w-md"
    >
      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          Choisissez le type de bracket à générer :
        </p>

        <div class="flex flex-col gap-3">
          <div
            class="p-4 border rounded-lg cursor-pointer transition-all"
            :class="{
              'border-primary-500 bg-primary-50 dark:bg-primary-900/20': bracketTypeToGenerate === 'single',
              'border-gray-200 dark:border-gray-700 hover:border-gray-300': bracketTypeToGenerate !== 'single',
            }"
            @click="bracketTypeToGenerate = 'single'"
          >
            <div class="flex items-center gap-3">
              <i class="fa fa-trophy text-xl text-primary-500"></i>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">Simple élimination</h4>
                <p class="text-sm text-gray-500">Une défaite = éliminé</p>
              </div>
            </div>
          </div>

          <div
            class="p-4 border rounded-lg cursor-pointer transition-all"
            :class="{
              'border-primary-500 bg-primary-50 dark:bg-primary-900/20': bracketTypeToGenerate === 'double',
              'border-gray-200 dark:border-gray-700 hover:border-gray-300': bracketTypeToGenerate !== 'double',
            }"
            @click="bracketTypeToGenerate = 'double'"
          >
            <div class="flex items-center gap-3">
              <i class="fa fa-trophy text-xl text-orange-500"></i>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-white">Double élimination</h4>
                <p class="text-sm text-gray-500">Deux défaites pour être éliminé</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" text @click="showGenerateDialog = false" />
        <Button
          label="Générer"
          icon="fa fa-check"
          :loading="generating"
          @click="handleGenerateBracket"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBracketService, type BracketRound as BracketRoundType } from '@/composables/bracket/bracket.service'
import { useViewport } from '@/composables/useViewport'
import { useToast } from 'primevue/usetoast'
import BracketNavigation from './BracketNavigation.vue'
import BracketRound from './BracketRound.vue'
import type { BracketType } from '@/composables/bracket/bracket.api'

interface Props {
  tournamentId: string
  canManage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: false,
})

const toast = useToast()
const { isMobile } = useViewport()
const {
  loading,
  error,
  generating,
  organizedBracket,
  hasMatches,
  isDoubleElimination,
  loadBracket,
  generateBracket,
  getRoundLabel: getServiceRoundLabel,
} = useBracketService()

const selectedBracketType = ref<'winner' | 'loser' | 'grand_final'>('winner')
const currentRoundIndex = ref(0)
const showGenerateDialog = ref(false)
const bracketTypeToGenerate = ref<BracketType>('single')

// Touch handling for swipe
const touchStartX = ref(0)
const roundContainer = ref<HTMLElement | null>(null)

const currentRounds = computed<BracketRoundType[]>(() => {
  if (selectedBracketType.value === 'grand_final') {
    return organizedBracket.value.grandFinal.length > 0
      ? [{ roundNumber: 999, matches: organizedBracket.value.grandFinal }]
      : []
  }
  if (selectedBracketType.value === 'loser') {
    return organizedBracket.value.loser
  }
  return organizedBracket.value.winner
})

const currentRound = computed(() => {
  return currentRounds.value[currentRoundIndex.value] || null
})

const currentRoundLabel = computed(() => {
  if (!currentRound.value) return ''
  if (selectedBracketType.value === 'grand_final') return 'Grande Finale'
  return getRoundLabel(currentRound.value.roundNumber)
})

function getRoundLabel(roundNumber: number): string {
  const totalRounds = currentRounds.value.length
  return getServiceRoundLabel(roundNumber, totalRounds, selectedBracketType.value)
}

// Reset round index when changing bracket type
watch(selectedBracketType, () => {
  currentRoundIndex.value = 0
})

function handleTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
}

function handleTouchEnd(e: TouchEvent) {
  const touchEndX = e.changedTouches[0].clientX
  const diff = touchStartX.value - touchEndX

  if (Math.abs(diff) > 50) {
    if (diff > 0 && currentRoundIndex.value < currentRounds.value.length - 1) {
      currentRoundIndex.value++
    } else if (diff < 0 && currentRoundIndex.value > 0) {
      currentRoundIndex.value--
    }
  }
}

async function handleGenerateBracket() {
  try {
    await generateBracket(props.tournamentId, bracketTypeToGenerate.value)
    showGenerateDialog.value = false
    toast.add({
      severity: 'success',
      summary: 'Bracket généré',
      detail: `Le bracket ${bracketTypeToGenerate.value === 'single' ? 'simple' : 'double'} élimination a été créé`,
      life: 3000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err instanceof Error ? err.message : 'Impossible de générer le bracket',
      life: 5000,
    })
  }
}

onMounted(() => {
  loadBracket(props.tournamentId)
})

// Reload when tournament changes
watch(() => props.tournamentId, (newId) => {
  if (newId) {
    loadBracket(newId)
    currentRoundIndex.value = 0
    selectedBracketType.value = 'winner'
  }
})
</script>

<style scoped>
.bracket-round-container {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.bracket-round-container::-webkit-scrollbar {
  height: 6px;
}

.bracket-round-container::-webkit-scrollbar-track {
  background: transparent;
}

.bracket-round-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

@media (max-width: 768px) {
  .bracket-round-container {
    scroll-snap-type: x mandatory;
  }
}
</style>
