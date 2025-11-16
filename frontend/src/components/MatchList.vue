<template>
  <div class="match-list">
    <div v-if="loading" class="flex justify-center py-6">
      <ProgressSpinner />
    </div>

    <div v-else>
      <div v-if="displayedMatches.length === 0" class="text-center py-6 text-gray-500">
        Aucun match trouvé.
      </div>

      <ul v-else class="space-y-4">
        <li
          v-for="match in pagedMatches"
          :key="match.id"
          class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex items-center justify-between"
        >
          <div class="flex items-center gap-4">
            <div class="flex flex-col">
              <div class="text-sm text-gray-500">{{ formatDate(match.createdAt) }}</div>
              <div class="text-lg font-medium text-gray-900 dark:text-white">
                <span>{{ teamLabel(match.teamA) }}</span>
                <span class="mx-2 text-gray-400">vs</span>
                <span>{{ teamLabel(match.teamB) }}</span>
              </div>
              <div class="text-sm text-gray-500">Statut: {{ match.status }}</div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {{ match.scoreA }} - {{ match.scoreB }}
            </div>
            <Button
              v-if="match.status === 'scheduled'"
              label="Compléter"
              icon="fas fa-edit"
              severity="info"
              size="small"
              @click="completeMatch(match)"
            />
            <Button text icon="pi pi-eye" @click="goToMatch(match.id)" />
          </div>
        </li>
      </ul>

      <div v-if="total > pageSize" class="mt-4">
        <Paginator :first="first" :rows="pageSize" :totalRecords="total" @page="onPage" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchService } from '@/composables/match.service'
import type { ClientMatchModel } from '@skill-arena/shared/types/index'

interface Props {
  tournamentId?: string
  playerId?: string
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
})

const router = useRouter()
const { listMatches } = useMatchService()

const loading = ref(false)
const matches = ref<ClientMatchModel[]>([])
const displayedMatches = ref<ClientMatchModel[]>([])

const pageSize = ref(props.pageSize)
const currentPage = ref(0)

const total = computed(() => displayedMatches.value.length)
const first = computed(() => currentPage.value * pageSize.value)
const pagedMatches = computed(() =>
  displayedMatches.value.slice(first.value, first.value + pageSize.value),
)

function formatDate(date: string | Date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function teamLabel(
  team: { name?: string; participants?: Array<{ user?: { displayName?: string } }> } | undefined,
) {
  if (!team) return 'N/A'
  if (team.name) return team.name
  // For teams with participants, join first two names
  if (team.participants && team.participants.length > 0) {
    return team.participants
      .map((p) => p.user?.displayName || 'Joueur')
      .slice(0, 2)
      .join(', ')
  }
  return 'Équipe'
}

function goToMatch(id: string) {
  router.push(`/matches/${id}`)
}

function completeMatch(match: ClientMatchModel) {
  if (match.tournamentId) {
    router.push(`/tournaments/${match.tournamentId}/create-match?matchId=${match.id}`)
  }
}

async function loadMatches() {
  loading.value = true
  try {
    const filters: { tournamentId?: string } = {}
    if (props.tournamentId) filters.tournamentId = props.tournamentId

    const result = await listMatches(filters)

    // Newest first — backend already returns desc by id but ensure createdAt sort
    // createdAt is already a Date object (converted by interceptor)
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    matches.value = result

    displayedMatches.value = matches.value
    // reset pagination
    currentPage.value = 0
  } catch (err) {
    console.error('Erreur lors du chargement des matchs:', err)
    displayedMatches.value = []
  } finally {
    loading.value = false
  }
}

function onPage(event: { first: number; rows: number }) {
  currentPage.value = Math.floor(event.first / event.rows)
}

watch(() => [props.tournamentId, props.playerId], loadMatches, { immediate: true })

onMounted(() => loadMatches())
</script>

<style scoped>
.match-list li {
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}
.match-list li:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}
</style>
