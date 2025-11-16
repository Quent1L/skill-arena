<template>
  <div class="tournament-detail-view">
    <div v-if="loading" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>

    <Message v-else-if="error" severity="error" class="mb-6">
      {{ error }}
    </Message>

    <div v-else-if="tournament" class="space-y-6">
      <Card>
        <template #header>
          <div class="p-6 pb-0">
            <TournamentHeader
              :name="tournament.name"
              :description="tournament.description"
              :status="tournament.status"
              :mode="tournament.mode"
              :is-authenticated="isAuthenticated"
              :is-participant="isParticipant"
              :can-join="canJoinTournament"
              :can-leave="canLeaveTournament"
              :can-create-match="canCreateMatch"
              :can-manage="canManageTournament"
              :joining="joining"
              :leaving="leaving"
              @join="joinTournament"
              @leave="leaveTournament"
              @create-match="createMatch"
              @edit="editTournament"
            />
          </div>
        </template>

        <template #content>
          <TournamentInfoGrid
            :mode="tournament.mode"
            :team-mode="tournament.teamMode"
            :min-team-size="tournament.minTeamSize"
            :max-team-size="tournament.maxTeamSize"
            :participant-count="participantCount"
            :start-date="tournament.startDate"
            :end-date="tournament.endDate"
            :duration="tournamentDuration"
            :point-per-victory="tournament.pointPerVictory"
            :point-per-draw="tournament.pointPerDraw"
            :point-per-loss="tournament.pointPerLoss"
            :allow-draw="tournament.allowDraw"
          />
        </template>
      </Card>

      <Tabs v-model:value="activeTab">
        <TabList>
          <Tab value="0">Classement</Tab>
          <Tab value="1">Matchs</Tab>
          <Tab value="2">
            <div class="flex items-center">
              <div>Participants</div>
              <Badge class="ml-2" :value="participantCount" severity="info" size="small" />
            </div>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="0">
            <p class="m-0">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
              exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
              dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
          </TabPanel>
          <TabPanel value="1">
            <div class="p-0">
              <MatchList :tournament-id="tournamentId" />
            </div>
          </TabPanel>
          <TabPanel value="2">
            <Card>
              <template #content>
                <TournamentParticipantsList
                  :participants="participants"
                  :loading="loadingParticipants"
                />
              </template>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <Card v-else class="text-center py-12">
      <template #content>
        <div class="space-y-4">
          <i class="pi pi-exclamation-triangle text-4xl text-orange-400"></i>
          <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Tournoi introuvable
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            Le tournoi que vous cherchez n'existe pas ou n'est plus disponible.
          </p>
          <div>
            <Button label="Retour aux tournois" @click="router.push('/')" class="text-blue-600" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTournamentService } from '@/composables/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import MatchList from '@/components/MatchList.vue'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import TournamentInfoGrid from '@/components/tournament/TournamentInfoGrid.vue'
import TournamentParticipantsList from '@/components/tournament/TournamentParticipantsList.vue'
import { calculateDuration } from '@/utils/DateUtils'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, appUser } = useAuth()
const {
  currentTournament: tournament,
  loading,
  error,
  isTournamentOpenForJoin,
  canLeaveTournament: canLeaveTournamentCheck,
  canCreateMatchInTournament,
  canManageTournament: canManageTournamentCheck,
  loadTournamentWithErrorHandling,
} = useTournamentService()
const {
  participants,
  participantCount,
  loading: loadingParticipants,
  isUserParticipant,
  joinTournamentAndReload,
  leaveTournamentAndReload,
  getTournamentParticipants,
} = useParticipantService()

const joining = ref(false)
const leaving = ref(false)
const activeTab = ref('0')

const tournamentId = computed(() => route.params.id as string)

const isParticipant = computed(() => isUserParticipant(appUser.value?.id))

const canJoinTournament = computed(() => isTournamentOpenForJoin(tournament.value))

const canLeaveTournament = computed(() => canLeaveTournamentCheck(tournament.value))

const canManageTournament = computed(() => {
  if (!isAuthenticated.value || !tournament.value) return false
  return canManageTournamentCheck(tournament.value)
})

const canCreateMatch = computed(() =>
  canCreateMatchInTournament(tournament.value, isAuthenticated.value, isParticipant.value),
)

const tournamentDuration = computed(() => {
  if (!tournament.value) return ''
  return calculateDuration(tournament.value.startDate, tournament.value.endDate)
})

onMounted(() => {
  const tab = route.query.tab as string | undefined
  if (tab && ['0', '1', '2'].includes(tab)) {
    activeTab.value = tab
  }
})

async function loadTournament() {
  await loadTournamentWithErrorHandling(tournamentId.value)
}

async function loadParticipants() {
  await getTournamentParticipants(tournamentId.value)
}

async function joinTournament() {
  try {
    joining.value = true
    await joinTournamentAndReload(tournamentId.value)
  } catch (err) {
    console.error("Erreur lors de l'inscription:", err)
  } finally {
    joining.value = false
  }
}

async function leaveTournament() {
  try {
    leaving.value = true
    await leaveTournamentAndReload(tournamentId.value)
  } catch (err) {
    console.error('Erreur lors de la désinscription:', err)
  } finally {
    leaving.value = false
  }
}

function editTournament() {
  router.push(`/admin/tournaments/${tournamentId.value}/edit`)
}

function createMatch() {
  router.push(`/tournaments/${tournamentId.value}/create-match`)
}

onMounted(async () => {
  await loadTournament()
  if (tournament.value) {
    await loadParticipants()
  }
})
</script>

<style scoped>
.tournament-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .tournament-detail-view {
    padding: 1rem;
  }
}
</style>
