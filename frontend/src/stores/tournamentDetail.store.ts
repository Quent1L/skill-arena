import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useTournamentStatsService } from '@/composables/tournament/tournament-stats.service'
import { playerApi } from '@/composables/player/player.api'
import { calculateDuration } from '@/utils/DateUtils'
import type { MmrChartPoint, PlayerStatsResponse } from '@skol-arena/shared/types/index'

export const useTournamentDetailStore = defineStore('tournamentDetail', () => {
  const router = useRouter()
  const { isAuthenticated, appUser, userRole } = useAuth()

  const tournamentSvc = useTournamentService()
  const participantSvc = useParticipantService()
  const rankedSvc = useRankedService()
  const statsSvc = useTournamentStatsService()

  // Local state
  const tournamentId = ref('')
  const isInitialLoading = ref(true)
  const joining = ref(false)
  const leaving = ref(false)
  const profileChartHistory = ref<MmrChartPoint[]>([])
  const playerStats = ref<PlayerStatsResponse | null>(null)
  const isLeaderboardRecalculating = ref(false)

  // Pass-through refs from services
  const tournament = tournamentSvc.currentTournament
  const error = tournamentSvc.error
  const participants = participantSvc.participants
  const participantCount = participantSvc.participantCount
  const loadingParticipants = participantSvc.loading
  const rankedLeaderboard = rankedSvc.leaderboard
  const rankedProvisionalLeaderboard = rankedSvc.provisionalLeaderboard
  const rankedTiers = rankedSvc.tiers
  const playerMmr = rankedSvc.playerMmr
  const playerOpponentQuality = rankedSvc.playerOpponentQuality
  const weeklyMmrLeaders = rankedSvc.weeklyMmrLeaders
  const rankedLoading = rankedSvc.loading
  const rankedProvisionalLoading = rankedSvc.provisionalLoading
  const tournamentStats = statsSvc.stats
  const tournamentStatsLoading = statsSvc.loading
  const statsError = statsSvc.error

  // Computed permissions
  const isParticipant = computed(() => participantSvc.isUserParticipant(appUser.value?.id))

  const canJoinTournament = computed(
    () =>
      tournamentSvc.isTournamentOpenForJoin(tournament.value) &&
      appUser.value?.role !== 'kiosk',
  )

  const canLeaveTournament = computed(() => tournamentSvc.canLeaveTournament(tournament.value))

  const canManageTournament = computed(() => {
    if (!isAuthenticated.value || !tournament.value) return false
    return tournamentSvc.canManageTournament(tournament.value)
  })

  const canCreateMatch = computed(() =>
    tournamentSvc.canCreateMatchInTournament(
      tournament.value,
      isAuthenticated.value,
      isParticipant.value,
      userRole.value,
    ),
  )

  const tournamentDuration = computed(() => {
    if (!tournament.value) return ''
    return calculateDuration(tournament.value.startDate, tournament.value.endDate)
  })

  const playerLeaderboardRank = computed(() => {
    if (!appUser.value || !rankedLeaderboard.value.length) return undefined
    const idx = rankedLeaderboard.value.findIndex((p) => p.player?.id === appUser.value?.id)
    return idx >= 0 ? idx + 1 : undefined
  })

  const menuItems = computed(() => {
    const items: { label: string; icon: string; command: () => void }[] = []
    if (canManageTournament.value) {
      items.push({
        label: 'Modifier',
        icon: 'fa fa-pencil',
        command: () => router.push(`/admin/tournaments/${tournamentId.value}/edit`),
      })
      if (tournament.value?.mode) {
        items.push({
          label: 'Recalculer les points',
          icon: 'fa fa-calculator',
          command: () => recalculatePoints(),
        })
      }
      items.push({
        label: 'Vider le cache',
        icon: 'fa fa-trash-can',
        command: () => clearCache(),
      })
    }
    if (isAuthenticated.value && isParticipant.value && canLeaveTournament.value) {
      items.push({ label: 'Quitter', icon: 'fa fa-user-minus', command: () => leaveTournament() })
    }
    return items
  })

  // Actions
  async function initialize(id: string) {
    tournamentId.value = id
    isInitialLoading.value = true
    try {
      await tournamentSvc.loadTournamentWithErrorHandling(id)
      if (tournament.value) {
        await participantSvc.getTournamentParticipants(id)
        if (tournament.value.mode === 'ranked') {
          await rankedSvc.loadLeaderboard(id)
        }
      }
    } finally {
      isInitialLoading.value = false
    }
  }

  async function joinTournament() {
    try {
      joining.value = true
      await participantSvc.joinTournamentAndReload(tournamentId.value)
    } finally {
      joining.value = false
    }
  }

  async function leaveTournament() {
    try {
      leaving.value = true
      await participantSvc.leaveTournamentAndReload(tournamentId.value)
    } finally {
      leaving.value = false
    }
  }

  async function reloadParticipants() {
    await participantSvc.getTournamentParticipants(tournamentId.value)
  }

  async function recalculatePoints() {
    await tournamentSvc.recalculatePoints(tournamentId.value)
  }

  async function clearCache() {
    await tournamentSvc.clearCache(tournamentId.value)
  }

  async function ensureLeaderboard() {
    if (!rankedLeaderboard.value.length) {
      await rankedSvc.loadLeaderboard(tournamentId.value)
    }
  }

  async function ensurePlayerProfile() {
    if (!appUser.value?.id) return
    if (!playerMmr.value) {
      const [chartHistory] = await Promise.all([
        rankedSvc.loadPlayerMmr(tournamentId.value, appUser.value.id),
        playerApi.getStats(appUser.value.id, { tournamentId: tournamentId.value })
          .then((s) => { playerStats.value = s }),
      ])
      profileChartHistory.value = chartHistory
    }
  }

  async function ensureStats() {
    if (!tournamentStats.value) {
      await statsSvc.loadStats(tournamentId.value)
    }
  }

  // MMR only exists in ranked seasons, so the weekly ranking is fetched on demand
  // rather than bundled into the (cached, mode-agnostic) tournament stats payload.
  async function ensureWeeklyMmrLeaders() {
    if (tournament.value?.mode !== 'ranked') return
    if (!weeklyMmrLeaders.value) {
      await rankedSvc.loadWeeklyMmrLeaders(tournamentId.value)
    }
  }

  async function reloadPlayerProfile() {
    if (!appUser.value?.id) return
    const [chartHistory] = await Promise.all([
      rankedSvc.loadPlayerMmr(tournamentId.value, appUser.value.id),
      playerApi.getStats(appUser.value.id, { tournamentId: tournamentId.value })
        .then((s) => { playerStats.value = s }),
    ])
    profileChartHistory.value = chartHistory
  }

  async function refreshSilently() {
    const promises: Promise<unknown>[] = [
      reloadTournament(),
      reloadParticipants(),
    ]
    if (tournament.value?.mode === 'ranked' && rankedLeaderboard.value.length) {
      promises.push(reloadLeaderboard())
    }
    if (playerMmr.value !== null) {
      promises.push(reloadPlayerProfile())
    }
    if (tournamentStats.value !== null) {
      promises.push(reloadStats())
    }
    if (weeklyMmrLeaders.value !== null) {
      promises.push(rankedSvc.loadWeeklyMmrLeaders(tournamentId.value))
    }
    await Promise.all(promises)
  }

  async function reloadTournament() {
    await tournamentSvc.loadTournamentWithErrorHandling(tournamentId.value)
  }

  async function reloadStats() {
    await statsSvc.loadStats(tournamentId.value)
  }

  async function reloadLeaderboard() {
    await rankedSvc.loadLeaderboard(tournamentId.value)
  }

  async function loadProvisionalLeaderboard() {
    await rankedSvc.loadProvisionalLeaderboard(tournamentId.value)
  }

  return {
    // Identity
    tournamentId,
    // UI state
    isInitialLoading,
    joining,
    leaving,
    // Tournament
    tournament,
    error,
    tournamentDuration,
    // Participants
    participants,
    participantCount,
    loadingParticipants,
    // Ranked
    rankedLeaderboard,
    rankedProvisionalLeaderboard,
    rankedTiers,
    playerMmr,
    playerOpponentQuality,
    playerStats,
    rankedLoading,
    rankedProvisionalLoading,
    isLeaderboardRecalculating,
    profileChartHistory,
    playerLeaderboardRank,
    weeklyMmrLeaders,
    // Tournament stats
    tournamentStats,
    tournamentStatsLoading,
    statsError,
    // Computed permissions
    isParticipant,
    canJoinTournament,
    canLeaveTournament,
    canManageTournament,
    canCreateMatch,
    menuItems,
    // Auth pass-through
    isAuthenticated,
    appUser,
    // Actions
    initialize,
    joinTournament,
    leaveTournament,
    reloadParticipants,
    recalculatePoints,
    clearCache,
    ensureLeaderboard,
    ensurePlayerProfile,
    ensureStats,
    ensureWeeklyMmrLeaders,
    reloadTournament,
    reloadStats,
    reloadLeaderboard,
    reloadPlayerProfile,
    refreshSilently,
    loadProvisionalLeaderboard,
  }
})
