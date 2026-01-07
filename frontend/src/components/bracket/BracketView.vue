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

    <!-- Bracket Viewer Container -->
    <div v-else class="bracket-container w-full overflow-hidden">
      <CustomBracket
        v-if="bracketData"
        :matches="bracketData.match"
        :participants="bracketData.participant"
        @match-click="handleMatchClick"
      />
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
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBracketService } from '@/composables/bracket/bracket.service'
import { useToast } from 'primevue/usetoast'
import type { BracketType } from '@/composables/bracket/bracket.api'
import CustomBracket from './CustomBracket.vue'
import type { Match } from 'brackets-model'

interface Props {
  tournamentId: string
  canManage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canManage: false,
})

const router = useRouter()
const toast = useToast()
const {
  loading,
  error,
  generating,
  bracketData,
  hasMatches,
  loadBracket,
  generateBracket,
} = useBracketService()

const showGenerateDialog = ref(false)
const bracketTypeToGenerate = ref<BracketType>('single')

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

// Handle click on bracket match to navigate to match detail
function handleMatchClick(match: Match) {
  if (match?.id) {
    router.push(`/matches/${match.id}`);
  }
}

onMounted(() => {
  loadBracket(props.tournamentId)
})

// Reload when tournament changes
watch(() => props.tournamentId, (newId) => {
  if (newId) {
    loadBracket(newId)
  }
})
</script>

<style scoped>
.bracket-container {
  min-height: 500px;
  width: 100%;
  background: var(--bracket-bg-color, var(--surface-ground));
  color: var(--bracket-text-color, var(--text-color));
}
</style>
