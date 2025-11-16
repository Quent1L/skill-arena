<template>
  <div class="match-list">
    <div v-if="loading" class="flex justify-center py-6">
      <ProgressSpinner />
    </div>

    <div v-else>
      <div v-if="displayedMatches.length === 0" class="text-center py-6 text-gray-500">
        Aucun match trouvé.
      </div>

      <ul v-else class="space-y-3 md:space-y-4">
        <li
          v-for="match in pagedMatches"
          :key="match.id"
          class="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 cursor-pointer"
          @click="goToMatch(match.id)"
        >
          <!-- Mobile: Stack layout -->
          <div class="flex-1 w-full md:w-auto">
            <!-- Date and Status (mobile: top, desktop: left) -->
            <div class="flex items-center justify-between mb-2 md:mb-1">
              <div class="text-xs md:text-sm text-gray-500">{{ formatDate(match.createdAt) }}</div>
              <!-- Status tag: mobile only -->
              <Tag 
                v-if="isMobile"
                :value="getStatusLabel(match.status)" 
                :severity="getStatusSeverity(match.status)"
              />
            </div>

            <!-- Teams and Score (mobile: vertical centered, desktop: horizontal) -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <!-- Team A -->
              <div class="flex items-center justify-center sm:justify-end gap-2 flex-1 min-w-0 order-1 sm:order-1">
                <span 
                  :class="[
                    'text-sm md:text-base lg:text-lg font-medium text-gray-900 dark:text-white truncate text-center sm:text-right',
                    { 'font-bold text-green-600 dark:text-green-400': match.winnerSide === 'A' }
                  ]"
                  :title="getFullTeamLabel(match.teamA)"
                >
                  {{ getTeamLabel(match.teamA) }}
                </span>
                <i 
                  v-if="match.winnerSide === 'A'" 
                  class="fa fa-trophy text-yellow-500 flex-shrink-0 text-xs md:text-sm"
                ></i>
              </div>

              <!-- Score (always visible, centered) -->
              <div class="flex items-center justify-center gap-2 sm:gap-3 flex-shrink-0 order-2 sm:order-2 px-2 sm:px-4">
                <span 
                  :class="[
                    'text-base md:text-lg font-semibold',
                    match.winnerSide === 'A' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
                  ]"
                >
                  {{ match.scoreA }}
                </span>
                <span class="text-gray-400">-</span>
                <span 
                  :class="[
                    'text-base md:text-lg font-semibold',
                    match.winnerSide === 'B' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
                  ]"
                >
                  {{ match.scoreB }}
                </span>
              </div>

              <!-- Team B -->
              <div class="flex items-center justify-center sm:justify-start gap-2 flex-1 min-w-0 order-3 sm:order-3">
                <span 
                  :class="[
                    'text-sm md:text-base lg:text-lg font-medium text-gray-900 dark:text-white truncate text-center sm:text-left',
                    { 'font-bold text-green-600 dark:text-green-400': match.winnerSide === 'B' }
                  ]"
                  :title="getFullTeamLabel(match.teamB)"
                >
                  {{ getTeamLabel(match.teamB) }}
                </span>
                <i 
                  v-if="match.winnerSide === 'B'" 
                  class="fa fa-trophy text-yellow-500 flex-shrink-0 text-xs md:text-sm"
                ></i>
              </div>
            </div>

            <!-- Status (desktop only) -->
            <div v-if="!isMobile" class="mt-1">
              <Tag 
                :value="getStatusLabel(match.status)" 
                :severity="getStatusSeverity(match.status)"
              />
            </div>
          </div>

          <!-- Actions (mobile: full width, desktop: auto) -->
          <div 
            v-if="match.status === 'scheduled'"
            class="flex items-center gap-2 w-full md:w-auto md:flex-shrink-0"
            @click.stop
          >
            <Button
              :label="isMobile ? undefined : 'Compléter'"
              icon="fas fa-edit"
              severity="info"
              size="small"
              class="flex-1 md:flex-initial"
              @click="completeMatch(match)"
            />
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
const isMobile = ref(false)

const pageSize = ref(props.pageSize)
const currentPage = ref(0)

const total = computed(() => displayedMatches.value.length)
const first = computed(() => currentPage.value * pageSize.value)
const pagedMatches = computed(() =>
  displayedMatches.value.slice(first.value, first.value + pageSize.value),
)

function checkMobile() {
  isMobile.value = window.innerWidth < 768 // md breakpoint
}

function formatDate(date: string | Date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function getTeamLabel(
  team: { name?: string; participants?: Array<{ user?: { displayName?: string } }> } | undefined,
): string {
  if (!team) return 'N/A'
  
  // Adjust max length based on screen size
  // Use a more generous limit to avoid unnecessary truncation
  const maxLength = isMobile.value ? 30 : 45
  
  if (team.name) {
    return team.name.length > maxLength ? team.name.substring(0, maxLength) + '...' : team.name
  }
  
  // For teams with participants
  if (team.participants && team.participants.length > 0) {
    const names = team.participants.map((p) => p.user?.displayName || 'Joueur')
    const label = names.join(', ')
    
    // Only truncate if the label is actually too long
    // This ensures we show all names if there's space
    if (label.length > maxLength) {
      // Show first name + count if too long
      const first = names[0] || 'Joueur'
      const rest = names.length - 1
      return rest > 0 ? `${first} +${rest}` : first.substring(0, maxLength) + '...'
    }
    
    // If we have space, show all names
    return label
  }
  return 'Équipe'
}

function getFullTeamLabel(
  team: { name?: string; participants?: Array<{ user?: { displayName?: string } }> } | undefined,
): string {
  if (!team) return 'N/A'
  if (team.name) return team.name
  if (team.participants && team.participants.length > 0) {
    return team.participants
      .map((p) => p.user?.displayName || 'Joueur')
      .join(', ')
  }
  return 'Équipe'
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: 'Planifié',
    reported: 'Résultat saisi',
    pending_confirmation: 'En attente',
    confirmed: 'Confirmé',
    disputed: 'Contesté',
    finalized: 'Finalisé',
    cancelled: 'Annulé',
  }
  return labels[status] || status
}

function getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    scheduled: 'info',
    reported: 'warn',
    pending_confirmation: 'warn',
    confirmed: 'success',
    disputed: 'danger',
    finalized: 'success',
    cancelled: 'secondary',
  }
  return severities[status] || 'info'
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

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  loadMatches()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.match-list li {
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease,
    background-color 0.15s ease;
  cursor: pointer;
}

.match-list li:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  background-color: rgba(0, 0, 0, 0.02);
}

.match-list li:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.dark .match-list li:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Ensure text truncation works properly */
.match-list .truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Responsive adjustments for very small screens */
@media (max-width: 640px) {
  .match-list li {
    padding: 0.75rem;
  }
}

/* Ensure buttons don't shrink on mobile */
@media (max-width: 768px) {
  .match-list .p-button {
    min-width: 2.5rem;
  }
}
</style>
