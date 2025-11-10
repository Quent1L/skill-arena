<template>
  <div class="tournaments-view">
    <!-- Header avec bouton admin conditionnel -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Tournois disponibles
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Découvrez et participez aux tournois en cours
        </p>
      </div>
      
      <!-- Bouton administration (visible seulement pour les admins) -->
      <div v-if="canManageTournaments" class="flex gap-3">
        <Button
          label="Gestion des tournois"
          icon="pi pi-cog"
          @click="router.push('/admin/tournaments')"
          class="bg-blue-600 hover:bg-blue-700"
        />
      </div>
    </div>

    <!-- Filtres -->
    <Card class="mb-6">
      <template #content>
        <div class="flex flex-wrap gap-4">
          <div class="flex-1 min-w-48">
            <label for="status-filter" class="block text-sm font-medium mb-2">Statut</label>
            <Select
              id="status-filter"
              v-model="filters.status"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              placeholder="Tous les statuts"
              class="w-full"
              @change="loadTournaments"
            />
          </div>
          
          <div class="flex-1 min-w-48">
            <label for="mode-filter" class="block text-sm font-medium mb-2">Mode</label>
            <Select
              id="mode-filter"
              v-model="filters.mode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              placeholder="Tous les modes"
              class="w-full"
              @change="loadTournaments"
            />
          </div>
          
          <div class="flex items-end">
            <Button
              label="Réinitialiser"
              text
              @click="resetFilters"
              class="text-gray-600"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Message d'erreur -->
    <Message v-if="error" severity="error" :closable="true" class="mb-6">
      {{ error }}
    </Message>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- Liste des tournois -->
    <div v-else-if="tournaments.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <TournamentCard
        v-for="tournament in tournaments"
        :key="tournament.id"
        :tournament="tournament"
        @click="viewTournament(tournament)"
      />
    </div>

    <!-- État vide -->
    <Card v-else class="text-center py-12">
      <template #content>
        <div class="space-y-4">
          <i class="pi pi-trophy text-4xl text-gray-400"></i>
          <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Aucun tournoi trouvé
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ hasFilters ? 'Aucun tournoi ne correspond à vos critères.' : 'Il n\'y a actuellement aucun tournoi disponible.' }}
          </p>
          <div v-if="hasFilters">
            <Button
              label="Effacer les filtres"
              text
              @click="resetFilters"
              class="text-blue-600"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentService } from '@/composables/tournament.service'
import { useAuth } from '@/composables/useAuth'
import TournamentCard from '@/components/TournamentCard.vue'
import type { TournamentStatus, TournamentMode, BaseTournament } from '@skill-arena/shared'

const router = useRouter()
const { 
  tournaments, 
  loading, 
  error, 
  listTournaments,
} = useTournamentService()
const { isSuperAdmin, isAuthenticated } = useAuth()

// Permissions
const canManageTournaments = computed(() => {
  return isAuthenticated.value && isSuperAdmin.value
})

// Filtres
const filters = ref<{
  status?: TournamentStatus
  mode?: TournamentMode
}>({})

const statusOptions = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Ouvert aux inscriptions', value: 'open' },
  { label: 'En cours', value: 'ongoing' },
  { label: 'Terminé', value: 'finished' },
]

const modeOptions = [
  { label: 'Championnat', value: 'championship' },
  { label: 'Bracket', value: 'bracket' },
]

const hasFilters = computed(() => {
  return !!(filters.value.status || filters.value.mode)
})

// Actions
function resetFilters() {
  filters.value = {}
  loadTournaments()
}

async function loadTournaments() {
  try {
    await listTournaments({
      status: filters.value.status,
      mode: filters.value.mode,
    })
  } catch (err) {
    console.error('Erreur lors du chargement des tournois:', err)
  }
}

function viewTournament(tournament: BaseTournament) {
  // Rediriger vers la page de détail du tournoi quand elle sera créée
  console.log('Voir le tournoi:', tournament.name)
  // router.push(`/tournaments/${tournament.id}`)
}

// Lifecycle
onMounted(() => {
  loadTournaments()
})
</script>

<style scoped>
.tournaments-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .tournaments-view {
    padding: 1rem;
  }
}
</style>