<template>
  <div class="tournaments-view">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Évènements compétitifs</h1>
        <p class="text-gray-600 dark:text-gray-400">Découvrez et participez aux évènements en cours</p>
      </div>
      <Button
        v-if="canManageTournaments"
        icon="fas fa-gears"
        v-tooltip.top="'Administration'"
        @click="router.push('/admin')"
      />
    </div>

    <Message v-if="error" severity="error" :closable="true" class="mb-6">{{ error }}</Message>

    <!-- Tag filters + switch -->
    <div v-if="!loading" class="flex flex-wrap items-center gap-3 mb-6">
      <Button
        v-for="tag in availableTags"
        :key="tag.key"
        :label="tag.label"
        :icon="tag.icon"
        :severity="selectedTags.includes(tag.key) ? 'primary' : 'secondary'"
        size="small"
        rounded
        @click="toggleTag(tag.key)"
      />

      <div v-if="hasFinishedEvents" class="flex items-center gap-2 ml-auto">
        <label class="text-sm text-gray-600 dark:text-gray-400">Terminés</label>
        <InputSwitch v-model="showFinished" />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="displayedEvents.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <TournamentCard
        v-for="event in displayedEvents"
        :key="event.id"
        :tournament="event"
        @click="navigateToEvent(event)"
      />
    </div>

    <Card v-else class="text-center py-12">
      <template #content>
        <div class="space-y-4">
          <i class="pi pi-trophy text-4xl text-gray-400"></i>
          <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300">Aucun évènement trouvé</h3>
          <p class="text-gray-500 dark:text-gray-400">
            {{ selectedTags.length > 0 ? 'Aucun évènement ne correspond à vos filtres.' : "Il n'y a actuellement aucun évènement disponible." }}
          </p>
          <div v-if="selectedTags.length > 0">
            <Button label="Effacer les filtres" text @click="selectedTags = []" class="text-blue-600" />
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
import type { ClientTournamentSummary } from '@skill-arena/shared'

const router = useRouter()
const { tournaments, loading, error, listTournaments } = useTournamentService()
const { seasons, loadSeasons } = useRankedService()
const { isSuperAdmin, isAuthenticated } = useAuth()

const canManageTournaments = computed(() => isAuthenticated.value && isSuperAdmin.value)

const selectedTags = ref<string[]>([])
const showFinished = ref(false)

const allEvents = computed<ClientTournamentSummary[]>(() =>
  [...tournaments.value, ...seasons.value].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  ),
)

const activeEvents = computed(() =>
  allEvents.value.filter((e) => ['open', 'ongoing'].includes(e.status)),
)

const hasFinishedEvents = computed(() => allEvents.value.some((e) => e.status === 'finished'))

const availableTags = computed(() => {
  const modes = new Set(activeEvents.value.map((e) => e.mode))
  return [
    { key: 'ranked', label: 'Ranked', icon: 'fa fa-ranking-star' },
    { key: 'championship', label: 'Championnat', icon: 'fa fa-trophy' },
    { key: 'bracket', label: 'Bracket', icon: 'fa fa-sitemap' },
  ].filter((t) => modes.has(t.key as ClientTournamentSummary['mode']))
})

const displayedEvents = computed(() => {
  let events = allEvents.value
  if (!showFinished.value) events = events.filter((e) => e.status !== 'finished')
  if (selectedTags.value.length > 0)
    events = events.filter((e) => selectedTags.value.includes(e.mode))
  return events
})

function toggleTag(key: string) {
  const idx = selectedTags.value.indexOf(key)
  if (idx === -1) selectedTags.value.push(key)
  else selectedTags.value.splice(idx, 1)
}

function navigateToEvent(event: ClientTournamentSummary) {
  if (event.mode === 'ranked') router.push(`/ranked/${event.id}`)
  else router.push(`/tournaments/${event.id}`)
}

onMounted(() => {
  Promise.all([listTournaments(), loadSeasons()])
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
