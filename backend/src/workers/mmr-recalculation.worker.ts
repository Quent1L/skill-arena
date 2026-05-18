import type { Task } from 'graphile-worker';
import { mmrCalculationService } from '../services/mmr-calculation.service';
import { mmrAnimationEventService } from '../services/mmr-animation-event.service';
import { rankedSeasonRepository } from '../repository/ranked-season.repository';
import { rankedSeasonService } from '../services/ranked-season.service';
import { webSocketService } from '../services/websocket.service';
import { logger } from '../utils/logger';

interface FinalizeMmrPayload {
  matchId: string;
  tournamentId: string;
}

interface CancelMmrPayload {
  matchId: string;
  tournamentId: string;
  cancelledMatchPlayedAt: string;
}

const finalizeMatchMmr: Task = async (rawPayload) => {
  const { matchId, tournamentId } = rawPayload as FinalizeMmrPayload;
  logger.info({ matchId, tournamentId }, '[Worker] finalize_match_mmr start');

  await mmrCalculationService.processMatchFinalization(matchId);

  await mmrAnimationEventService
    .createOfficialEventsAndBroadcast(matchId, tournamentId)
    .catch((err) => logger.error({ err }, '[Worker] official animation event failed'));

  await refreshRankedCaches(tournamentId);

  webSocketService.broadcastToTournament(tournamentId, {
    event: 'leaderboard_updated',
    data: { seasonId: tournamentId },
  });

  logger.info({ matchId, tournamentId }, '[Worker] finalize_match_mmr done');
};

const cancelMatchMmr: Task = async (rawPayload) => {
  const { matchId, tournamentId, cancelledMatchPlayedAt } = rawPayload as CancelMmrPayload;
  logger.info({ matchId, tournamentId }, '[Worker] cancel_match_mmr start');

  const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
  if (!rankedConfig) return;

  const mmrChanges = await mmrCalculationService.cascadeRecalculateAfterCancellation(
    matchId,
    tournamentId,
    new Date(cancelledMatchPlayedAt),
  );

  await mmrAnimationEventService
    .createCancellationEventsAndBroadcast(matchId, tournamentId, mmrChanges)
    .catch((err) => logger.error({ err }, '[Worker] cancellation animation event failed'));

  await refreshRankedCaches(tournamentId);

  webSocketService.broadcastToTournament(tournamentId, {
    event: 'leaderboard_updated',
    data: { seasonId: tournamentId },
  });

  logger.info({ matchId, tournamentId }, '[Worker] cancel_match_mmr done');
};

async function refreshRankedCaches(tournamentId: string): Promise<void> {
  await rankedSeasonService
    .computeAndCacheOfficial(tournamentId)
    .catch((err) => logger.error({ err }, '[Worker] official cache refresh failed'));
  await rankedSeasonService
    .computeAndCacheProvisional(tournamentId)
    .catch((err) => logger.error({ err }, '[Worker] provisional cache refresh failed'));
}

export const taskList = {
  finalize_match_mmr: finalizeMatchMmr,
  cancel_match_mmr: cancelMatchMmr,
};
