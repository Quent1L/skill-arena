/**
 * Composable pour calculer et afficher le classement d'un tournoi
 */

import { ref, computed } from 'vue'
import { collections } from '@/utils/pocketbase'
import type { Tournament, TeamStats, TeamExpanded, Match } from '@/types'

export function useLeaderboard(tournamentId: string) {
  const tournament = ref<Tournament | null>(null)
  const leaderboard = ref<TeamStats[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Calculer le classement
   */
  const calculateLeaderboard = async () => {
    loading.value = true
    error.value = null

    try {
      // Récupérer le tournoi
      tournament.value = await collections.tournaments.getOne<Tournament>(tournamentId, {
        $autoCancel: false,
      })

      // Récupérer les équipes du tournoi
      const teams = await collections.teams.getFullList<TeamExpanded>({
        filter: `tournament = "${tournamentId}"`,
        expand: 'players',
        $autoCancel: false,
      })

      // Récupérer les matchs joués
      const matches = await collections.matches.getFullList<Match>({
        filter: `tournament = "${tournamentId}" && validated_by != ""`,
        $autoCancel: false,
      })

      // Calculer les statistiques pour chaque équipe
      const stats: TeamStats[] = teams.map((team) => {
        const teamMatches = matches.filter((m) => m.teamA === team.id || m.teamB === team.id)

        let wins = 0
        let draws = 0
        let losses = 0
        let scoreFor = 0
        let scoreAgainst = 0

        teamMatches.forEach((match) => {
          const isTeamA = match.teamA === team.id
          const teamScore = isTeamA ? match.scoreA || 0 : match.scoreB || 0
          const opponentScore = isTeamA ? match.scoreB || 0 : match.scoreA || 0

          scoreFor += teamScore
          scoreAgainst += opponentScore

          if (match.winner === team.id) {
            wins++
          } else if (!match.winner) {
            draws++
          } else {
            losses++
          }
        })

        // Calculer les points
        const pointsWin = tournament.value?.points_win || 3
        const pointsDraw = tournament.value?.points_draw || 1
        const pointsLoss = tournament.value?.points_loss || 0

        const points = wins * pointsWin + draws * pointsDraw + losses * pointsLoss

        return {
          team,
          matches_played: teamMatches.length,
          wins,
          draws,
          losses,
          points,
          score_for: scoreFor,
          score_against: scoreAgainst,
          score_difference: scoreFor - scoreAgainst,
          rank: 0, // Sera calculé après le tri
        }
      })

      // Trier par points, différence de buts, puis buts marqués
      stats.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.score_difference !== a.score_difference)
          return b.score_difference - a.score_difference
        return b.score_for - a.score_for
      })

      // Assigner les rangs
      stats.forEach((stat, index) => {
        stat.rank = index + 1
      })

      leaderboard.value = stats
      return stats
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erreur lors du calcul du classement'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Obtenir le classement d'une équipe spécifique
   */
  const getTeamStats = (teamId: string): TeamStats | undefined => {
    return leaderboard.value.find((stat) => stat.team.id === teamId)
  }

  /**
   * Top 3 des équipes
   */
  const topThree = computed(() => leaderboard.value.slice(0, 3))

  return {
    tournament: computed(() => tournament.value),
    leaderboard: computed(() => leaderboard.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    topThree,
    calculateLeaderboard,
    getTeamStats,
  }
}
