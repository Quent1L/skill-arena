<template>
  <div class="min-h-screen py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div v-if="loading" class="text-center py-12">
        <ProgressSpinner />
        <p class="mt-4">Chargement du tournoi...</p>
      </div>

      <Message v-else-if="error" severity="error" :closable="false">
        {{ error }}
      </Message>

      <div v-else-if="tournament" class="space-y-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <Tag :severity="statusSeverity" :value="statusLabel" />
              <Tag :value="typeLabel" severity="secondary" />
            </div>
            <p
              v-if="tournament.description"
              v-html="tournament.description"
              class="mt-2 max-w-3xl"
            ></p>
          </div>

          <div class="flex gap-2">
            <Button
              v-if="!isParticipating && currentUser"
              label="Participer"
              icon="fas fa-user-plus"
              @click="handleJoinTournament"
              :loading="joiningTournament"
            />
            <Button
              v-else-if="canUnregister && currentUser"
              label="Se désinscrire"
              icon="fas fa-user-minus"
              severity="secondary"
              outlined
              @click="handleLeaveTournament"
              :loading="leavingTournament"
            />
            <Tag
              v-else-if="isParticipating && hasPlayedMatches && currentUser"
              value="Inscrit"
              severity="success"
              icon="fas fa-check"
              class="text-base px-4 py-2"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <template #content>
              <div class="flex items-center gap-3">
                <div class="p-3 bg-primary/10 rounded-lg">
                  <i class="fas fa-calendar text-2xl text-primary"></i>
                </div>
                <div>
                  <p class="text-sm opacity-70">Date de début</p>
                  <p class="font-semibold">{{ formatDate(tournament.start_date) }}</p>
                </div>
              </div>
            </template>
          </Card>

          <Card>
            <template #content>
              <div class="flex items-center gap-3">
                <div class="p-3 bg-primary/10 rounded-lg">
                  <i class="fas fa-calendar-check text-2xl text-primary"></i>
                </div>
                <div>
                  <p class="text-sm opacity-70">Date de fin</p>
                  <p class="font-semibold">{{ formatDate(tournament.end_date) }}</p>
                </div>
              </div>
            </template>
          </Card>

          <Card>
            <template #content>
              <div class="flex items-center gap-3">
                <div class="p-3 bg-primary/10 rounded-lg">
                  <i class="fas fa-users text-2xl text-primary"></i>
                </div>
                <div>
                  <p class="text-sm opacity-70">Participants</p>
                  <p class="font-semibold">{{ participantCount }}</p>
                </div>
              </div>
            </template>
          </Card>

          <Card>
            <template #content>
              <div class="flex items-center gap-3">
                <div class="p-3 bg-primary/10 rounded-lg">
                  <i class="fas fa-futbol text-2xl text-primary"></i>
                </div>
                <div>
                  <p class="text-sm opacity-70">Matchs</p>
                  <p class="font-semibold">
                    {{ tournament.matches_played }} / {{ tournament.matches_total }}
                  </p>
                </div>
              </div>
            </template>
          </Card>
        </div>

        <Tabs value="0">
          <TabList>
            <Tab value="0">
              <i class="fas fa-list-ol mr-2"></i>
              <span>Classement</span>
            </Tab>
            <Tab value="1">
              <i class="fas fa-calendar-days mr-2"></i>
              <span>Matchs</span>
            </Tab>
            <Tab value="2">
              <i class="fas fa-users mr-2"></i>
              <span>Équipes</span>
            </Tab>
            <Tab value="3">
              <i class="fas fa-cog mr-2"></i>
              <span>Configuration</span>
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel value="0">
              <Card>
                <template #content>
                  <div class="text-center py-12">
                    <i class="fas fa-trophy text-6xl opacity-30 mb-4"></i>
                    <p class="text-lg">Classement à venir</p>
                    <p class="text-sm opacity-70 mt-2">
                      Le classement sera disponible une fois les matchs commencés
                    </p>
                  </div>
                </template>
              </Card>
            </TabPanel>

            <TabPanel value="1">
              <Card>
                <template #content>
                  <div class="text-center py-12">
                    <i class="fas fa-calendar text-6xl opacity-30 mb-4"></i>
                    <p class="text-lg">Aucun match planifié</p>
                    <p class="text-sm opacity-70 mt-2">
                      Les matchs seront générés automatiquement lors du début du tournoi
                    </p>
                  </div>
                </template>
              </Card>
            </TabPanel>

            <TabPanel value="2">
              <Card>
                <template #content>
                  <div v-if="participantUsers.length === 0" class="text-center py-12">
                    <i class="fas fa-users text-6xl opacity-30 mb-4"></i>
                    <p class="text-lg">Aucun participant inscrit</p>
                    <p class="text-sm opacity-70 mt-2">Soyez le premier à rejoindre ce tournoi !</p>
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      v-for="user in participantUsers"
                      :key="user.id"
                      class="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
                    >
                      <Avatar
                        :label="getUserInitials(user)"
                        shape="circle"
                        class="bg-primary text-white"
                      />
                      <div class="flex-1">
                        <p class="font-semibold">{{ user.name || user.username }}</p>
                        <p class="text-sm opacity-70">{{ user.email }}</p>
                      </div>
                      <Tag
                        v-if="user.id === currentUser?.id"
                        value="Vous"
                        severity="info"
                        class="ml-auto"
                      />
                    </div>
                  </div>
                </template>
              </Card>
            </TabPanel>

            <TabPanel value="3">
              <Card>
                <template #content>
                  <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 class="font-semibold mb-2">Type de tournoi</h3>
                        <p>{{ typeLabel }}</p>
                      </div>

                      <div>
                        <h3 class="font-semibold mb-2">Taille des équipes</h3>
                        <p>
                          {{ tournament.min_team_size }}
                          <span v-if="tournament.min_team_size !== tournament.max_team_size">
                            - {{ tournament.max_team_size }}
                          </span>
                          joueurs
                        </p>
                      </div>

                      <div v-if="tournament.type === 'championship'">
                        <h3 class="font-semibold mb-2">Points</h3>
                        <ul class="space-y-1">
                          <li>Victoire: {{ tournament.points_win ?? 3 }} pts</li>
                          <li v-if="tournament.allow_draws">
                            Match nul: {{ tournament.points_draw ?? 1 }} pts
                          </li>
                          <li>Défaite: {{ tournament.points_loss ?? 0 }} pts</li>
                        </ul>
                      </div>

                      <div>
                        <h3 class="font-semibold mb-2">Match nul autorisé</h3>
                        <Tag :severity="tournament.allow_draws ? 'success' : 'secondary'">
                          {{ tournament.allow_draws ? 'Oui' : 'Non' }}
                        </Tag>
                      </div>

                      <div v-if="tournament.max_score">
                        <h3 class="font-semibold mb-2">Score maximum</h3>
                        <p>{{ tournament.max_score }} points</p>
                      </div>

                      <div v-if="tournament.team_flexibility">
                        <h3 class="font-semibold mb-2">Flexibilité des équipes</h3>
                        <p>
                          {{
                            tournament.team_flexibility === 'fixed'
                              ? 'Équipes fixes'
                              : 'Équipes dynamiques'
                          }}
                        </p>
                      </div>
                      <div v-if="tournament.team_repeat_limit != null">
                        <h3 class="font-semibold mb-2">Limite de répétition des équipes</h3>
                        <p>
                          {{
                            tournament.team_repeat_limit === 0
                              ? 'Aucune limite'
                              : tournament.team_repeat_limit + ' fois'
                          }}
                        </p>
                      </div>
                    </div>
                  </div>
                </template>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTournaments } from '@/composables/useTournaments'
import { useParticipants } from '@/composables/useParticipants'
import { useAuth } from '@/composables/useAuth'
import { useMatches } from '@/composables/useMatches'
import { useTeams } from '@/composables/useTeams'
import type { TournamentWithStats, User } from '@/types'

const route = useRoute()
const { fetchTournament, loading, error } = useTournaments()
const { currentUser } = useAuth()

const tournament = ref<TournamentWithStats | null>(null)
const tournamentId = route.params.id as string

const {
  participantUsers,
  participantCount,
  fetchParticipants,
  joinTournament,
  leaveTournament,
  isUserParticipant,
  getUserParticipation,
} = useParticipants(tournamentId)

const { matches, fetchMatches } = useMatches(tournamentId)
const { teams, fetchTeams } = useTeams(tournamentId)

const joiningTournament = ref(false)
const leavingTournament = ref(false)

const isParticipating = computed(() => {
  return currentUser.value ? isUserParticipant(currentUser.value.id) : false
})

const hasPlayedMatches = computed(() => {
  if (!currentUser.value || !isParticipating.value) return false

  const userId = currentUser.value.id
  const userTeams = teams.value.filter((team) => team.players.includes(userId))
  const userTeamIds = new Set(userTeams.map((team) => team.id))

  const playedMatches = matches.value.filter((match) => {
    const isInMatch = userTeamIds.has(match.teamA) || userTeamIds.has(match.teamB)
    const isValidated = !!match.validated_by
    return isInMatch && isValidated
  })

  return playedMatches.length > 0
})

const canUnregister = computed(() => {
  return isParticipating.value && !hasPlayedMatches.value
})

const statusSeverity = computed(() => {
  if (!tournament.value) return 'info'

  switch (tournament.value.status) {
    case 'active':
      return 'success'
    case 'upcoming':
      return 'warning'
    case 'finished':
      return 'secondary'
    default:
      return 'info'
  }
})

const statusLabel = computed(() => {
  if (!tournament.value) return 'À venir'

  switch (tournament.value.status) {
    case 'active':
      return 'En cours'
    case 'upcoming':
      return 'À venir'
    case 'finished':
      return 'Terminé'
    default:
      return 'À venir'
  }
})

const typeLabel = computed(() => {
  if (!tournament.value) return ''

  switch (tournament.value.type) {
    case 'championship':
      return 'Championnat'
    case 'bracket':
      return 'Élimination directe'
    default:
      return tournament.value.type
  }
})

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getUserInitials(user: User): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }
  return user.username ? user.username.substring(0, 2).toUpperCase() : '??'
}

async function handleJoinTournament() {
  if (!currentUser.value || !tournament.value) return

  joiningTournament.value = true
  try {
    await joinTournament({
      tournament: tournament.value.id,
      user: currentUser.value.id,
    })
  } catch (err) {
    console.error("Erreur lors de l'inscription:", err)
  } finally {
    joiningTournament.value = false
  }
}

async function handleLeaveTournament() {
  if (!currentUser.value) return

  const participation = getUserParticipation(currentUser.value.id)
  if (!participation) return

  leavingTournament.value = true
  try {
    await leaveTournament(participation.id)
  } catch (err) {
    console.error('Erreur lors de la désinscription:', err)
  } finally {
    leavingTournament.value = false
  }
}

onMounted(async () => {
  try {
    tournament.value = await fetchTournament(tournamentId)
    await Promise.all([
      fetchParticipants(tournamentId),
      fetchMatches(tournamentId),
      fetchTeams(tournamentId),
    ])
  } catch (err) {
    console.error('Erreur lors du chargement:', err)
  }
})
</script>
