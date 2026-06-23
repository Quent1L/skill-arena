<template>
  <div class="space-y-4 sm:space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
      <div class="flex items-center gap-2 mb-6">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
          <i class="fa fa-medal text-purple-600 dark:text-purple-400 text-sm sm:text-base" />
        </div>
        <div>
          <div class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">Badges du tournoi</div>
          <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <template v-if="appUser">{{ earnedCount }} / {{ availableBadges.length }} obtenus</template>
            <template v-else>{{ availableBadges.length }} badges disponibles</template>
          </div>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-8">
        <ProgressSpinner />
      </div>

      <div v-else-if="availableBadges.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        <i class="fa fa-medal text-4xl mb-3 block opacity-30" />
        <p>Aucun badge disponible</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <div
          v-for="badge in availableBadges"
          :key="badge.ruleId"
          class="flex flex-col items-center text-center p-4 rounded-xl gap-2 transition-all hover:scale-[1.03] hover:shadow-md cursor-default"
          :class="isEarned(badge.ruleId)
            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500'
            : 'bg-surface-100 dark:bg-surface-800 opacity-50 hover:opacity-80'"
        >
          <i
            :class="[badge.icon || 'fa fa-medal', isEarned(badge.ruleId) ? 'text-purple-600' : 'text-gray-400 dark:text-gray-500']"
            class="text-3xl"
          />
          <div class="font-semibold text-sm leading-tight">{{ badge.label }}</div>
          <div class="text-xs text-surface-500 line-clamp-2">{{ badge.description }}</div>
          <div v-if="isEarned(badge.ruleId)" class="text-xs text-purple-600 dark:text-purple-400 font-medium">
            <i class="fa fa-check mr-1" />{{ formatDate(getEarnedDate(badge.ruleId)) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { rulesApi } from '@/composables/rules/rules.api'
import { useAuth } from '@/composables/useAuth'
import { onWsEvent } from '@/composables/notification/notification.socket'
import type { AvailableBadge, ClientPlayerBadge } from '@skill-arena/shared/types/index'
import ProgressSpinner from 'primevue/progressspinner'

const route = useRoute()
const { appUser } = useAuth()

const availableBadges = ref<AvailableBadge[]>([])
const playerBadges = ref<ClientPlayerBadge[]>([])
const loading = ref(true)

const earnedRuleIds = computed(() => new Set(playerBadges.value.map((b) => b.ruleId)))
const earnedCount = computed(() => availableBadges.value.filter((b) => earnedRuleIds.value.has(b.ruleId)).length)

function isEarned(ruleId: string): boolean {
  return earnedRuleIds.value.has(ruleId)
}

function getEarnedDate(ruleId: string): Date | undefined {
  return playerBadges.value.find((b) => b.ruleId === ruleId)?.awardedAt
}

function formatDate(date: Date | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR')
}

async function load() {
  const tournamentId = route.params.id as string
  loading.value = true
  try {
    const [badges, earned] = await Promise.all([
      rulesApi.getAvailableBadges(tournamentId),
      appUser.value ? rulesApi.getPlayerBadges(appUser.value.id) : Promise.resolve([]),
    ])
    availableBadges.value = badges
    playerBadges.value = earned
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, load, { immediate: true })

const offAwarded = onWsEvent('badge_awarded', load)
const offRevoked = onWsEvent('badge_revoked', load)
onUnmounted(() => {
  offAwarded()
  offRevoked()
})
</script>
