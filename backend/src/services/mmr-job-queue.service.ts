import { makeWorkerUtils, type WorkerUtils } from 'graphile-worker';
import { webSocketService } from './websocket.service';
import { logger } from '../utils/logger';

let _utils: WorkerUtils | null = null;

async function getUtils(): Promise<WorkerUtils> {
  if (!_utils) {
    _utils = await makeWorkerUtils({ connectionString: process.env.DATABASE_URL! });
    await _utils.migrate();
  }
  return _utils;
}

export async function enqueueMmrFinalization(matchId: string, tournamentId: string): Promise<void> {
  try {
    const utils = await getUtils();
    await utils.addJob(
      'finalize_match_mmr',
      { matchId, tournamentId },
      { jobKey: `finalize:${matchId}`, queueName: `mmr:${tournamentId}` },
    );
    webSocketService.broadcastToTournament(tournamentId, {
      event: 'leaderboard_recalculating',
      data: { seasonId: tournamentId },
    });
  } catch (err) {
    logger.error({ err, matchId, tournamentId }, '[MMRQueue] Failed to enqueue finalization');
  }
}

export async function enqueueMmrSeasonRecalculation(tournamentId: string): Promise<void> {
  try {
    const utils = await getUtils();
    await utils.addJob(
      'recalculate_season_mmr',
      { tournamentId },
      { jobKey: `recalculate_season:${tournamentId}`, queueName: `mmr:${tournamentId}` },
    );
    webSocketService.broadcastToTournament(tournamentId, {
      event: 'leaderboard_recalculating',
      data: { seasonId: tournamentId },
    });
  } catch (err) {
    logger.error({ err, tournamentId }, '[MMRQueue] Failed to enqueue season recalculation');
  }
}

export async function enqueueMmrCascade(
  matchId: string,
  tournamentId: string,
  cancelledMatchPlayedAt: Date,
): Promise<void> {
  try {
    const utils = await getUtils();
    await utils.addJob(
      'cancel_match_mmr',
      { matchId, tournamentId, cancelledMatchPlayedAt: cancelledMatchPlayedAt.toISOString() },
      { jobKey: `cancel:${matchId}`, queueName: `mmr:${tournamentId}` },
    );
    webSocketService.broadcastToTournament(tournamentId, {
      event: 'leaderboard_recalculating',
      data: { seasonId: tournamentId },
    });
  } catch (err) {
    logger.error({ err, matchId, tournamentId }, '[MMRQueue] Failed to enqueue cascade');
  }
}
