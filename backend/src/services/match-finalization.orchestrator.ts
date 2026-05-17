import { bracketService } from './bracket.service'
import { mmrCalculationService } from './mmr-calculation.service'
import { mmrAnimationEventService } from './mmr-animation-event.service'
import { notificationService } from './notification.service'
import { rankedSeasonRepository } from '../repository/ranked-season.repository'
import { rankedSeasonService } from './ranked-season.service'
import { standingsService } from './standings.service'
import { matchRepository } from '../repository/match.repository'
import { playerComputedDataRepository } from '../repository/player-computed-data.repository'
import { tournamentStatsRepository } from '../repository/tournament-stats.repository'
import { logger } from '../utils/logger'

export class MatchFinalizationOrchestrator {
  async runPostFinalizationEffects(
    matchId: string,
    tournamentId: string,
    backgroundTasks?: Promise<void>[],
  ): Promise<void> {
    await notificationService.deleteActionsByMatchId(matchId)
    await bracketService.advanceWinnerToNextRound(matchId)
    await bracketService.advanceLoserToNextRound(matchId)
    await mmrCalculationService.processMatchFinalization(matchId)
    const mmrAnimationTask = mmrAnimationEventService
      .createOfficialEventsAndBroadcast(matchId, tournamentId)
      .catch((err) => logger.error({ err }, '[MmrAnimation] official event failed'))
    if (backgroundTasks) {
      backgroundTasks.push(mmrAnimationTask)
    }
    await this.refreshRankedCachesIfNeeded(tournamentId, backgroundTasks)
    await this.refreshStandingsAndStats(tournamentId, matchId)
  }

  async runPostCancellationEffects(matchId: string, tournamentId: string, cancelledMatchPlayedAt: Date): Promise<void> {
    const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId)
    if (rankedConfig) {
      const mmrChanges = await mmrCalculationService.cascadeRecalculateAfterCancellation(
        matchId,
        tournamentId,
        cancelledMatchPlayedAt,
      )
      await mmrAnimationEventService
        .createCancellationEventsAndBroadcast(matchId, tournamentId, mmrChanges)
        .catch((err) => logger.error({ err }, '[MmrAnimation] cancellation event failed'))
    }
    await this.refreshRankedCachesIfNeeded(tournamentId)
    await this.refreshStandingsAndStats(tournamentId, matchId)
  }

  private async refreshRankedCachesIfNeeded(
    tournamentId: string,
    backgroundTasks?: Promise<void>[],
  ): Promise<void> {
    const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId)
    if (!rankedConfig) return
    const officialTask = rankedSeasonService
      .computeAndCacheOfficial(tournamentId)
      .catch((err) => logger.error({ err }, '[Ranked] background cache update failed'))
    const provisionalTask = rankedSeasonService
      .computeAndCacheProvisional(tournamentId)
      .catch((err) => logger.error({ err }, '[Ranked] background cache update failed'))
    if (backgroundTasks) {
      backgroundTasks.push(officialTask, provisionalTask)
    }
  }

  private async refreshStandingsAndStats(tournamentId: string, matchId: string): Promise<void> {
    const tournament = await matchRepository.getTournament(tournamentId)
    if (tournament?.mode === 'championship') {
      if (tournament.teamMode === 'flex' && tournament.maxMatchesPerPlayer) {
        await standingsService.recalculatePointsInternal(tournamentId)
      } else {
        await standingsService.invalidateCache(tournamentId)
      }
    }
    const playerIds = await matchRepository.getPlayerIdsForMatch(matchId)
    if (playerIds.length > 0) {
      await playerComputedDataRepository.deleteMany(playerIds)
    }
    await tournamentStatsRepository.deleteComputedStats(tournamentId)
  }
}

export const matchFinalizationOrchestrator = new MatchFinalizationOrchestrator()
