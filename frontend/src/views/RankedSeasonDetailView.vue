<template>
  <div v-if="currentSeason">
    <!-- Mobile -->
    <RankedSeasonDetailMobile
      v-if="isMobile"
      :season-id="seasonId"
      :current-season="currentSeason"
      :leaderboard="leaderboard"
      :boundaries="boundaries"
      :player-mmr="playerMmr"
      :player-history="playerHistory"
      :loading="loading"
      :is-authenticated="isAuthenticated"
      :app-user="appUser"
      :can-create-match="currentSeason.status === 'ongoing' && isAuthenticated"
      :can-manage="isAdmin"
      :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
      @create-match="goToCreateMatch"
      @edit="goToEdit"
      @view-rules="goToRules"
      @tab-change="onTabChange"
    />

    <!-- Desktop -->
    <div v-else class="ranked-season-detail p-4">
      <TournamentHeader
        :name="currentSeason.name"
        :description="currentSeason.description ?? undefined"
        :status="currentSeason.status as TournamentStatus"
        :mode="'ranked'"
        :is-authenticated="isAuthenticated"
        :is-participant="false"
        :can-join="false"
        :can-leave="false"
        :can-create-match="currentSeason.status === 'ongoing' && isAuthenticated"
        :can-manage="isAdmin"
        :rules-id="currentSeason.rulesId"
        :show-recalculate="false"
        @create-match="goToCreateMatch"
        @edit="goToEdit"
        @view-rules="goToRules"
      />

      <Message v-if="error" severity="error" :closable="true" class="my-4">
        {{ error }}
      </Message>

      <Tabs v-model:value="activeTab" class="mt-6">
        <TabList>
          <Tab value="leaderboard">Classement</Tab>
          <Tab v-if="isAuthenticated && appUser" value="profile">Mon profil</Tab>
          <Tab value="history">Historique</Tab>
          <Tab value="matches">Matchs</Tab>
        </TabList>
        <TabPanels>
          <!-- Classement -->
          <TabPanel value="leaderboard">
            <RankedLeaderboard
              :players="leaderboard"
              :boundaries="boundaries"
              :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
              :loading="loading"
            />
          </TabPanel>

          <!-- Mon profil -->
          <TabPanel v-if="isAuthenticated && appUser" value="profile">
            <div v-if="playerMmr">
              <PlayerMmrProfile
                :mmr="playerMmr"
                :boundaries="boundaries"
                :placement-matches="currentSeason.rankedConfig?.placementMatches ?? 5"
              />
            </div>
            <div v-else class="text-center py-12 text-gray-500">
              <i class="fa fa-user-slash text-4xl mb-4 block"></i>
              <p>Vous n'avez pas encore de MMR pour cette saison.</p>
              <p class="text-sm mt-2">
                Déclarez votre premier match pour rejoindre le classement !
              </p>
            </div>
          </TabPanel>

          <!-- Historique MMR -->
          <TabPanel value="history">
            <div v-if="isAuthenticated && appUser">
              <RankedMatchHistory :history="playerHistory" :loading="loading" />
            </div>
            <div v-else class="text-center py-12 text-gray-500">
              Connectez-vous pour voir votre historique MMR.
            </div>
          </TabPanel>

          <!-- Matchs -->
          <TabPanel value="matches">
            <MatchList :tournament-id="seasonId" :bracket-mode="false" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>

  <div v-else-if="loading" class="flex justify-center items-center h-64">
    <ProgressSpinner />
  </div>

  <div v-else class="text-center py-12 text-gray-500">Saison introuvable.</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useAuth } from '@/composables/useAuth'
import { useViewport } from '@/composables/useViewport'
import type { TournamentStatus } from '@skill-arena/shared'
import TournamentHeader from '@/components/tournament/TournamentHeader.vue'
import MatchList from '@/components/MatchList.vue'
import RankedLeaderboard from '@/components/ranked/RankedLeaderboard.vue'
import PlayerMmrProfile from '@/components/ranked/PlayerMmrProfile.vue'
import RankedMatchHistory from '@/components/ranked/RankedMatchHistory.vue'
import RankedSeasonDetailMobile from '@/components/ranked/mobile/RankedSeasonDetailMobile.vue'

const router = useRouter()
const route = useRoute()
const { isAuthenticated, appUser, isAdmin } = useAuth()
const { isMobile } = useViewport()

const {
  currentSeason,
  leaderboard,
  boundaries,
  playerMmr,
  playerHistory,
  loading,
  error,
  loadSeasonById,
  loadLeaderboard,
  loadPlayerMmr,
  loadPlayerHistory,
} = useRankedService()

const activeTab = ref('leaderboard')
const seasonId = computed(() => route.params.id as string)

function goToCreateMatch() {
  router.push(`/tournaments/${seasonId.value}/create-match`)
}

function goToEdit() {
  router.push(`/admin/ranked/${seasonId.value}/edit`)
}

function goToRules() {
  router.push(`/tournaments/${seasonId.value}/rules`)
}

async function onTabChange(tab: string) {
  if (tab === 'profile' && appUser.value) {
    await loadPlayerMmr(seasonId.value, appUser.value.id)
  }
  if (tab === 'history' && appUser.value) {
    await loadPlayerHistory(seasonId.value, appUser.value.id)
  }
}

watch(activeTab, onTabChange)

onMounted(async () => {
  await loadSeasonById(seasonId.value)
  await loadLeaderboard(seasonId.value)
})
</script>

<style scoped>
.ranked-season-detail {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
