<template>
  <div class="admin-view">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Administration</h1>
      <p class="text-gray-600 dark:text-gray-400">
        Gérez les tournois et les disciplines de la plateforme
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Card Gestion des tournois -->
      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="navigateToTournaments">
        <template #content>
          <div class="text-center py-8">
            <div class="mb-4">
              <i class="fa fa-trophy text-5xl text-blue-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Gestion des tournois
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez, modifiez et gérez les tournois de la plateforme
            </p>
            <Button
              label="Accéder"
              icon="fa fa-arrow-right"
              class="bg-blue-600 hover:bg-blue-700"
              @click.stop="navigateToTournaments"
            />
          </div>
        </template>
      </Card>

      <!-- Card Gestion des disciplines -->
      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="navigateToDisciplines">
        <template #content>
          <div class="text-center py-8">
            <div class="mb-4">
              <i class="fa fa-gamepad text-5xl text-purple-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Gestion des disciplines
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez, modifiez et gérez les disciplines disponibles
            </p>
            <Button
              label="Accéder"
              icon="fa fa-arrow-right"
              class="bg-purple-600 hover:bg-purple-700"
              @click.stop="navigateToDisciplines"
            />
          </div>
        </template>
      </Card>
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateToInvitaionCode"
      >
        <template #content>
          <div class="text-center py-8">
            <div class="mb-4">
              <i class="fa fa-gamepad text-5xl text-purple-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Gestion des invitations
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez, modifiez et gérez les codes d'invitations
            </p>
            <Button
              label="Accéder"
              icon="fa fa-arrow-right"
              class="bg-purple-600 hover:bg-purple-700"
              @click.stop="navigateToInvitaionCode"
            />
          </div>
        </template>
      </Card>

      <!-- Card Saisons Ranked -->
      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="navigateToRanked">
        <template #content>
          <div class="text-center py-8">
            <div class="mb-4">
              <i class="fa fa-ranking-star text-5xl text-yellow-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Saisons Ranked
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez et gérez les saisons de mode compétitif ranked
            </p>
            <Button
              label="Accéder"
              icon="fa fa-arrow-right"
              class="bg-yellow-600 hover:bg-yellow-700"
              @click.stop="navigateToRanked"
            />
          </div>
        </template>
      </Card>

      <!-- Card Règles du jeu -->
      <Card class="cursor-pointer hover:shadow-lg transition-shadow" @click="navigateToRules">
        <template #content>
          <div class="text-center py-8">
            <div class="mb-4">
              <i class="fa fa-scroll text-5xl text-green-600"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Règles du jeu
            </h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Créez et gérez les règlements associés aux tournois
            </p>
            <Button
              label="Accéder"
              icon="fa fa-arrow-right"
              class="bg-green-600 hover:bg-green-700"
              @click.stop="navigateToRules"
            />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function navigateToTournaments() {
  router.push('/admin/tournaments')
}

function navigateToDisciplines() {
  router.push('/admin/disciplines')
}

function navigateToInvitaionCode() {
  router.push('/admin/invitations')
}

function navigateToRules() {
  router.push('/admin/rules')
}

function navigateToRanked() {
  router.push('/admin/ranked')
}
</script>

<style scoped>
.admin-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .admin-view {
    padding: 1rem;
  }
}
</style>
