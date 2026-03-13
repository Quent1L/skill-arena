<template>
  <div class="tournaments-view">
    <!-- Header avec bouton admin conditionnel -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tournois disponibles</h1>
        <p class="text-gray-600 dark:text-gray-400">
          Découvrez et participez aux tournois en cours
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Bouton filtres mobile -->
        <div class="md:hidden">
          <Button
            icon="fa fa-filter"
            severity="secondary"
            @click="showFilterDrawer = true"
            :badge="activeFilterCount > 0 ? String(activeFilterCount) : undefined"
            badge-severity="info"
          />
        </div>
        <!-- Bouton administration (visible seulement pour les admins) -->
        <Button
          v-if="canManageTournaments"
          icon="fas fa-gears"
          v-tooltip.top="'Administration'"
          @click="router.push('/admin')"
        />
      </div>
    </div>

    <!-- Filtres desktop (masqués sur mobile) -->
    <div class="mb-6 hidden md:block">
    <Card>
      <template #content>
        <div class="flex flex-wrap gap-4">
          <div class="flex-1 min-w-48">
            <label class="block text-sm font-medium mb-2">Statut</label>
            <Select
              v-model="filters.status"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              placeholder="Tous les statuts"
              class="w-full"
              show-clear
              @change="loadTournaments"
            />
          </div>
          <div class="flex-1 min-w-48">
            <label class="block text-sm font-medium mb-2">Mode</label>
            <Select
              v-model="filters.mode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              placeholder="Tous les modes"
              class="w-full"
              show-clear
              @change="loadTournaments"
            />
          </div>
          <div class="flex items-end">
            <Button label="Réinitialiser" text @click="resetFilters" class="text-gray-600" />
          </div>
        </div>
      </template>
    </Card>
    </div>

    <!-- Drawer filtres mobile -->
    <Drawer
      v-model:visible="showFilterDrawer"
      position="bottom"
      :style="{ height: 'auto', maxHeight: '85vh', borderRadius: '1rem 1rem 0 0' }"
      header="Filtres"
    >
      <div class="flex flex-col gap-5 pb-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Statut</label>
          <Select
            v-model="draftFilters.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            placeholder="Tous les statuts"
            class="w-full"
            show-clear
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Mode</label>
          <Select
            v-model="draftFilters.mode"
            :options="modeOptions"
            option-label="label"
            option-value="value"
            placeholder="Tous les modes"
            class="w-full"
            show-clear
          />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 pt-2">
          <Button
            label="Réinitialiser"
            severity="secondary"
            icon="fa fa-rotate-left"
            class="flex-1"
            @click="resetMobileFilters"
          />
          <Button
            label="Appliquer"
            icon="fa fa-check"
            class="flex-1"
            @click="applyMobileFilters"
          />
        </div>
      </template>
    </Drawer>

    <!-- Message d'erreur -->
    <Message v-if="error" severity="error" :closable="true" class="mb-6">
      {{ error }}
    </Message>

    <!-- Loading -->
    <!-- Saisons Ranked actives -->
    <div v-if="activeRankedSeasons.length > 0" class="mb-8">
      <h2 class="text-xl font-semibold mb-3 flex items-center gap-2">
        <i class="fa fa-ranking-star text-yellow-500"></i>
        Saisons Ranked actives
      </h2>
      <div class="flex flex-wrap gap-3">
        <Card
          v-for="season in activeRankedSeasons"
          :key="season.id"
          class="cursor-pointer hover:shadow-md transition-shadow min-w-48"
          @click="router.push(`/ranked/${season.id}`)"
        >
          <template #content>
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="font-semibold">{{ season.name }}</div>
                <div class="text-sm text-gray-500">{{ season.discipline?.name }}</div>
              </div>
              <Tag severity="success" value="En cours" />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <!-- Liste des tournois -->
    <div
      v-else-if="tournaments.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
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
            {{
              hasFilters
                ? 'Aucun tournoi ne correspond à vos critères.'
                : "Il n'y a actuellement aucun tournoi disponible."
            }}
          </p>
          <div v-if="hasFilters">
            <Button label="Effacer les filtres" text @click="resetFilters" class="text-blue-600" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useAuth } from '@/composables/useAuth'
import TournamentCard from '@/components/TournamentCard.vue'
import Drawer from 'primevue/drawer'
import type { TournamentStatus, TournamentMode, BaseTournament } from '@skill-arena/shared'

const router = useRouter()
const { tournaments, loading, error, listTournaments } = useTournamentService()
const { seasons: rankedSeasons, loadSeasons } = useRankedService()
const { isSuperAdmin, isAuthenticated } = useAuth()

const activeRankedSeasons = computed(() =>
  rankedSeasons.value.filter((s) => s.status === 'ongoing'),
)

const canManageTournaments = computed(() => isAuthenticated.value && isSuperAdmin.value)

// Filtres actifs (desktop + résultat des filtres mobile)
const filters = ref<{ status?: TournamentStatus; mode?: TournamentMode }>({})

// Filtres brouillons pour le drawer mobile
const draftFilters = ref<{ status?: TournamentStatus; mode?: TournamentMode }>({})

const showFilterDrawer = ref(false)

const statusOptions = computed(() => {
  const base = [
    { label: 'Ouvert aux inscriptions', value: 'open' },
    { label: 'En cours', value: 'ongoing' },
    { label: 'Terminé', value: 'finished' },
  ]
  if (isSuperAdmin.value) base.unshift({ label: 'Brouillon', value: 'draft' })
  return base
})

const modeOptions = [
  { label: 'Championnat', value: 'championship' },
  { label: 'Bracket', value: 'bracket' },
]

const hasFilters = computed(() => !!(filters.value.status || filters.value.mode))

const activeFilterCount = computed(() =>
  [filters.value.status, filters.value.mode].filter(Boolean).length
)

function resetFilters() {
  filters.value = {}
  draftFilters.value = {}
  loadTournaments()
}

function resetMobileFilters() {
  draftFilters.value = {}
}

function applyMobileFilters() {
  filters.value = { ...draftFilters.value }
  showFilterDrawer.value = false
  loadTournaments()
}

async function loadTournaments() {
  try {
    await listTournaments({ status: filters.value.status, mode: filters.value.mode })
  } catch (err) {
    console.error('Erreur lors du chargement des tournois:', err)
  }
}

function viewTournament(tournament: BaseTournament) {
  router.push(`/tournaments/${tournament.id}`)
}

onMounted(() => {
  loadTournaments()
  loadSeasons({ status: 'ongoing' })
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
