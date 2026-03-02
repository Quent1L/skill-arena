<template>
  <div class="max-w-5xl mx-auto p-4 space-y-6">
    <div v-if="error && !player" class="text-center text-red-500 py-8">
      <p>{{ error }}</p>
      <Button label="Retour" icon="fa fa-arrow-left" severity="secondary" @click="router.back()" class="mt-4" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button icon="fa fa-arrow-left" severity="secondary" text @click="router.back()" />
          <div>
            <h1 class="text-2xl font-bold">{{ player?.displayName ?? '...' }}</h1>
            <span v-if="player?.shortName" class="text-surface-500 dark:text-surface-400 text-sm">{{ player.shortName }}</span>
          </div>
        </div>
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
      </div>

      <!-- Filtres desktop (masqués sur mobile) -->
      <div class="hidden md:block">
      <Card>
        <template #content>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-sm text-surface-500">Tournoi</label>
              <Select
                v-model="selectedTournamentId"
                :options="tournamentOptions"
                option-label="label"
                option-value="value"
                placeholder="Tous les tournois"
                class="w-full"
                show-clear
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm text-surface-500">Mode</label>
              <SelectButton
                v-model="selectedMode"
                :options="modeOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
          </div>
          <div class="mt-3 flex justify-end">
            <Button label="Réinitialiser" severity="secondary" icon="fa fa-rotate-left" size="small" @click="resetFilters" />
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
            <label class="text-sm font-medium">Tournoi</label>
            <Select
              v-model="draftTournamentId"
              :options="tournamentOptions"
              option-label="label"
              option-value="value"
              placeholder="Tous les tournois"
              class="w-full"
              show-clear
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Mode</label>
            <SelectButton
              v-model="draftMode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              class="w-full"
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

      <!-- Stats -->
      <div v-if="loading" class="flex justify-center py-8">
        <ProgressSpinner />
      </div>

      <template v-else-if="stats && stats.totalMatches > 0">
        <!-- Summary -->
        <Card>
          <template #header>
            <div class="p-4 pb-0">
              <h2 class="text-lg font-semibold">Statistiques globales</h2>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">{{ stats.totalMatches }}</div>
                <div class="text-sm text-surface-500 mt-1">Matchs joués</div>
              </div>
              <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                <div class="text-3xl font-bold text-green-600 dark:text-green-400">{{ stats.winRate }}%</div>
                <div class="text-sm text-surface-500 mt-1">Taux de victoire</div>
              </div>
              <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                <div class="text-3xl font-bold">{{ stats.wins }}/{{ stats.draws }}/{{ stats.losses }}</div>
                <div class="text-sm text-surface-500 mt-1">V / N / D</div>
              </div>
              <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                <div class="text-3xl font-bold text-primary">{{ stats.averageScore }}</div>
                <div class="text-sm text-surface-500 mt-1">Score moyen</div>
              </div>
            </div>

            <!-- Relation stats -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div v-if="stats.mostFrequentPartners.length > 0">
                <h3 class="text-sm font-semibold text-surface-500 mb-2">Partenaires fréquents</h3>
                <div v-for="p in stats.mostFrequentPartners" :key="p.playerId" class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700 last:border-0">
                  <RouterLink :to="`/players/${p.playerId}`" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">{{ p.shortName }}</RouterLink>
                  <span class="text-sm text-surface-500">{{ p.count }} matchs</span>
                </div>
              </div>
              <div v-if="stats.bestPartners.length > 0">
                <h3 class="text-sm font-semibold text-surface-500 mb-2">Meilleurs partenaires</h3>
                <div v-for="p in stats.bestPartners" :key="p.playerId" class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700 last:border-0">
                  <RouterLink :to="`/players/${p.playerId}`" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">{{ p.shortName }}</RouterLink>
                  <span class="text-sm text-green-600">{{ p.count > 0 ? Math.round(p.wins / p.count * 100) : 0 }}% V</span>
                </div>
              </div>
              <div v-if="stats.nemeses.length > 0">
                <h3 class="text-sm font-semibold text-surface-500 mb-2">Adversaires difficiles</h3>
                <div v-for="p in stats.nemeses" :key="p.playerId" class="flex justify-between items-center py-1 border-b border-surface-200 dark:border-surface-700 last:border-0">
                  <RouterLink :to="`/players/${p.playerId}`" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">{{ p.shortName }}</RouterLink>
                  <span class="text-sm text-red-400">{{ p.losses }} défaites</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Tournament history -->
        <Card v-if="stats.tournamentHistory.length > 0">
          <template #header>
            <div class="p-4 pb-0">
              <h2 class="text-lg font-semibold">Historique des tournois</h2>
            </div>
          </template>
          <template #content>
            <div class="space-y-3">
              <RouterLink
                v-for="entry in stats.tournamentHistory"
                :key="entry.tournamentId"
                :to="`/tournaments/${entry.tournamentId}`"
                class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors no-underline"
              >
                <div class="flex items-center justify-between sm:flex-1 gap-2 min-w-0">
                  <span class="font-medium text-blue-600 dark:text-blue-400 truncate">{{ entry.tournamentName }}</span>
                  <Tag
                    :value="entry.mode === 'championship' ? 'Championnat' : 'Bracket'"
                    :severity="entry.mode === 'championship' ? 'info' : 'warn'"
                    class="flex-shrink-0 text-xs"
                  />
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm flex-shrink-0">
                  <span class="text-surface-500">{{ entry.matchesPlayed }} MJ</span>
                  <span class="text-green-600 dark:text-green-400 font-medium">{{ entry.wins }}V</span>
                  <span class="text-surface-500">{{ entry.draws }}N</span>
                  <span class="text-red-600 dark:text-red-400 font-medium">{{ entry.losses }}D</span>
                  <span v-if="entry.points !== undefined" class="text-blue-600 dark:text-blue-400 font-semibold">{{ entry.points }} pts</span>
                  <span v-if="entry.disciplineName" class="text-surface-400 italic">{{ entry.disciplineName }}</span>
                </div>
              </RouterLink>
            </div>
          </template>
        </Card>
      </template>

      <div v-else-if="!loading" class="text-center py-12 text-surface-400">
        <i class="fa fa-chart-bar text-4xl mb-4 block"></i>
        <p>Pas encore de statistique...</p>
      </div>

      <!-- Match history -->
      <Card>
        <template #header>
          <div class="p-4 pb-0">
            <h2 class="text-lg font-semibold">Historique des matchs</h2>
          </div>
        </template>
        <template #content>
          <MatchList :player-id="playerId" />
        </template>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerService } from '@/composables/player/player.service'
import type { PlayerStatsFilters } from '@skill-arena/shared/types/index'
import MatchList from '@/components/MatchList.vue'
import Drawer from 'primevue/drawer'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ProgressSpinner from 'primevue/progressspinner'

const route = useRoute()
const router = useRouter()
const { player, stats, availableTournaments, loading, error, loadPlayer, loadTournaments, loadStats } =
  usePlayerService()

const playerId = computed(() => route.params.id as string)

// Filtres actifs
const selectedTournamentId = ref<string | undefined>(undefined)
const selectedMode = ref<string | undefined>(undefined)

// Filtres brouillons pour le drawer mobile
const draftTournamentId = ref<string | undefined>(undefined)
const draftMode = ref<string | undefined>(undefined)

const showFilterDrawer = ref(false)

const tournamentOptions = computed(() => [
  { label: 'Tous les tournois', value: undefined },
  ...availableTournaments.value.map((t) => ({ label: t.name, value: t.id })),
])

const modeOptions = [
  { label: 'Tous', value: undefined },
  { label: 'Championnat', value: 'championship' },
  { label: 'Bracket', value: 'bracket' },
]

const activeFilterCount = computed(() =>
  [selectedTournamentId.value, selectedMode.value].filter(Boolean).length
)

// Desktop: apply on change
watch([selectedTournamentId, selectedMode], () => {
  applyFilters(selectedTournamentId.value, selectedMode.value)
})

function applyFilters(tournamentId: string | undefined, mode: string | undefined) {
  const filters: PlayerStatsFilters = {}
  if (tournamentId) filters.tournamentId = tournamentId
  if (mode) filters.tournamentMode = mode
  loadStats(playerId.value, filters)
}

function resetFilters() {
  selectedTournamentId.value = undefined
  selectedMode.value = undefined
  draftTournamentId.value = undefined
  draftMode.value = undefined
}

function resetMobileFilters() {
  draftTournamentId.value = undefined
  draftMode.value = undefined
}

function applyMobileFilters() {
  selectedTournamentId.value = draftTournamentId.value
  selectedMode.value = draftMode.value
  showFilterDrawer.value = false
  // watch will trigger applyFilters automatically
}

onMounted(() => {
  loadPlayer(playerId.value)
  loadTournaments(playerId.value)
  loadStats(playerId.value)
})
</script>
