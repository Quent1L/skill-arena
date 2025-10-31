<template>
  <div class="min-h-screen py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <p class="mt-2">Gérez vos tournois et suivez vos performances</p>
      </div>

      <Tabs value="0">
        <TabList>
          <Tab value="0">
            <span>En cours</span>
            <Badge
              v-if="activeTournaments.length > 0"
              :value="activeTournaments.length"
              severity="info"
              class="ml-2"
            />
          </Tab>
          <Tab value="1">
            <span>À venir</span>
            <Badge
              v-if="upcomingTournaments.length > 0"
              :value="upcomingTournaments.length"
              severity="warning"
              class="ml-2"
            />
          </Tab>
          <Tab value="2">
            <span>Terminés</span>
            <Badge
              v-if="finishedTournaments.length > 0"
              :value="finishedTournaments.length"
              class="ml-2"
            />
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="0">
            <div v-if="loading" class="text-center py-12">
              <ProgressSpinner />
              <p class="mt-4">Chargement des tournois...</p>
            </div>

            <Message v-else-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <div v-else-if="activeTournaments.length === 0" class="text-center py-12">
              <p class="text-lg">Aucun tournoi en cours</p>
              <p class="text-sm mt-2">Consultez les tournois à venir ou terminés</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <TournamentCard
                v-for="tournament in activeTournaments"
                :key="tournament.id"
                :tournament="tournament"
              />
            </div>
          </TabPanel>

          <TabPanel value="1">
            <div v-if="loading" class="text-center py-12">
              <ProgressSpinner />
              <p class="mt-4">Chargement des tournois...</p>
            </div>

            <Message v-else-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <div v-else-if="upcomingTournaments.length === 0" class="text-center py-12">
              <p class="text-lg">Aucun tournoi à venir</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <TournamentCard
                v-for="tournament in upcomingTournaments"
                :key="tournament.id"
                :tournament="tournament"
              />
            </div>
          </TabPanel>

          <TabPanel value="2">
            <div v-if="loading" class="text-center py-12">
              <ProgressSpinner />
              <p class="mt-4">Chargement des tournois...</p>
            </div>

            <Message v-else-if="error" severity="error" :closable="false">
              {{ error }}
            </Message>

            <div v-else-if="finishedTournaments.length === 0" class="text-center py-12">
              <p class="text-lg">Aucun tournoi terminé</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <TournamentCard
                v-for="tournament in finishedTournaments"
                :key="tournament.id"
                :tournament="tournament"
              />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTournaments } from '@/composables/useTournaments'
import TournamentCard from '@/components/TournamentCard.vue'

const {
  activeTournaments,
  upcomingTournaments,
  finishedTournaments,
  loading,
  error,
  fetchTournaments,
} = useTournaments()

onMounted(async () => {
  await fetchTournaments()
})
</script>
