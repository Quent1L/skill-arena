import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useParticipantService } from '@/composables/participant.service'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useMatchHistoryService } from '@/composables/match/match-history.service'
import { rankedApi } from '@/composables/ranked/ranked.api'
import { calculateDuration } from '@/utils/DateUtils'
import type { ClientMmrHistoryEntry } from '@skill-arena/shared/types/index'

export const useTournamentDetailStore = defineStore('tournamentDetail', () => {
  const { isAuthenticated, appUser, userRole } = useAuth()

  const tournamentSvc = useTournamentService()
  const participantSvc = useParticipantService()
  const rankedSvc = useRankedService()
  const matchHistorySvc = useMatchHistoryService()

  // Local state
  const tournamentId = ref('')
  const isInitialLoading = ref(true)
  const joining = ref(false)
  const leaving = ref(false)
  const profileChartHistory = ref<ClientMmrHistoryEntry[]>([])

  // Pass-through refs from services
  const tournament = tournamentSvc.currentTournament
  const error = tournamentSvc.error
  const participants = participantSvc.participants
  const participantCount = participantSvc.participantCount
  const loadingParticipants = participantSvc.loading
  const rankedLeaderboard = rankedSvc.leaderboard
  const rankedTiers = rankedSvc.tiers
  const playerMmr = rankedSvc.playerMmr
  const rankedLoading = rankedSvc.loading
  const matchHistory = matchHistorySvc.history
  const matchHistoryLoading = matchHistorySvc.loading
  const matchHistoryHasMore = matchHistorySvc.hasMore

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

  async function ensureLeaderboard() {
    if (!rankedLeaderboard.value.length) {
      await rankedSvc.loadLeaderboard(tournamentId.value)
    }
  }

  async function ensurePlayerProfile() {
    if (!appUser.value?.id) return
    if (!playerMmr.value) {
      await rankedSvc.loadPlayerMmr(tournamentId.value, appUser.value.id)
      profileChartHistory.value = await rankedApi.getPlayerHistory(
        tournamentId.value,
        appUser.value.id,
        { limit: 200 },
      )
    }
  }

  async function ensureMatchHistory() {
    if (!appUser.value?.id) return
    if (!matchHistory.value.length) {
      await matchHistorySvc.loadHistory(appUser.value.id, tournamentId.value)
    }
  }

  async function loadMoreMatchHistory() {
    await matchHistorySvc.loadMore()
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
    rankedTiers,
    playerMmr,
    rankedLoading,
    profileChartHistory,
    playerLeaderboardRank,
    // Match history
    matchHistory,
    matchHistoryLoading,
    matchHistoryHasMore,
    // Computed permissions
    isParticipant,
    canJoinTournament,
    canLeaveTournament,
    canManageTournament,
    canCreateMatch,
    // Auth pass-through
    isAuthenticated,
    appUser,
    // Actions
    initialize,
    joinTournament,
    leaveTournament,
    reloadParticipants,
    recalculatePoints,
    ensureLeaderboard,
    ensurePlayerProfile,
    ensureMatchHistory,
    loadMoreMatchHistory,
  }
})
