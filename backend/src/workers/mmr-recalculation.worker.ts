import type { Task } from 'graphile-worker';
import { mmrCalculationService } from '../services/mmr-calculation.service';
import { mmrAnimationEventService } from '../services/mmr-animation-event.service';
import { rankedSeasonRepository } from '../repository/ranked-season.repository';
import { playerMmrRepository } from '../repository/player-mmr.repository';
import { rankedSeasonService } from '../services/ranked-season.service';
import { webSocketService } from '../services/websocket.service';
import { rulesEvaluationService } from '../services/rules-evaluation.service';
import { badgeReconciliationService } from '../services/badge-reconciliation.service';
import { seasonRewindService } from '../services/season-rewind.service';
import { enqueueSeasonRewindGeneration } from '../services/mmr-job-queue.service';
import { tournamentRepository } from '../repository/tournament.repository';
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

  const mmrChanges = await mmrCalculationService.processMatchFinalization(matchId);

  // Evaluate rules first: produces the message injected into the MMR animation
  // and the badge revealed afterwards.
  const rulesOutputs = await rulesEvaluationService
    .evaluateMatchSubmitted(matchId)
    .catch((err) => {
      logger.error({ err }, '[Worker] rules evaluation failed');
      return new Map();
    });

  await mmrAnimationEventService
    .createOfficialEventsAndBroadcast(matchId, tournamentId, rulesOutputs)
    .catch((err) => logger.error({ err }, '[Worker] official animation event failed'));

  // A backdated finalization can ripple to third parties beyond this match's
  // own 2 participants (already handled above via createOfficialEventsAndBroadcast).
  // Those cascade-only players never got an animation/badge pass for their
  // rebuilt history — sync them the same way the cancellation cascade does.
  const cascadePlayerIds = [...mmrChanges].filter(([, c]) => c.reason === 'cascade').map(([playerId]) => playerId);
  if (cascadePlayerIds.length > 0) {
    await mmrAnimationEventService
      .persistRecalcEvents(tournamentId, cascadePlayerIds)
      .catch((err) => logger.error({ err }, '[Worker] finalization cascade animation event failed'));
    await badgeReconciliationService
      .reconcilePlayers(tournamentId, cascadePlayerIds)
      .catch((err) => logger.error({ err }, '[Worker] finalization cascade badge reconciliation failed'));
  }

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

  // Persist the cancelled-match summary event + re-sync posterior matches whose
  // delta changed (kills the phantom flood on the next finalization). No
  // per-event broadcast — a single mmr_recap_ready ping below makes clients
  // refetch all pending events as one grouped recap.
  await mmrAnimationEventService
    .persistCancellationEvents(matchId, tournamentId, mmrChanges)
    .catch((err) => logger.error({ err }, '[Worker] cancellation animation event failed'));
  await mmrAnimationEventService
    .persistRecalcEvents(tournamentId, [...mmrChanges.keys()])
    .catch((err) => logger.error({ err }, '[Worker] cascade recalc animation event failed'));

  // MMR history (incl. streak snapshots) is now rebuilt for every affected
  // player — reconcile their badges (revoke now-invalid, award newly-valid).
  await badgeReconciliationService
    .reconcilePlayers(tournamentId, [...mmrChanges.keys()])
    .catch((err) => logger.error({ err }, '[Worker] badge reconciliation failed'));

  await refreshRankedCaches(tournamentId);

  webSocketService.broadcastToTournament(tournamentId, {
    event: 'mmr_recap_ready',
    data: { seasonId: tournamentId, tournamentId },
  });
  webSocketService.broadcastToTournament(tournamentId, {
    event: 'leaderboard_updated',
    data: { seasonId: tournamentId },
  });

  logger.info({ matchId, tournamentId }, '[Worker] cancel_match_mmr done');
};

const reconcilePendingBadges: Task = async (rawPayload) => {
  const { force } = (rawPayload ?? {}) as { force?: boolean };
  logger.info({ force }, '[Worker] reconcile_pending_badges start');
  const result = await badgeReconciliationService.runPendingReconciliation(!!force);
  logger.info({ force, ran: result.ran }, '[Worker] reconcile_pending_badges done');
};

async function refreshRankedCaches(tournamentId: string): Promise<void> {
  await rankedSeasonService
    .computeAndCacheOfficial(tournamentId)
    .catch((err) => logger.error({ err }, '[Worker] official cache refresh failed'));
  await rankedSeasonService
    .computeAndCacheProvisional(tournamentId)
    .catch((err) => logger.error({ err }, '[Worker] provisional cache refresh failed'));
}

const recalculateSeasonMmr: Task = async (rawPayload) => {
  const { tournamentId } = rawPayload as { tournamentId: string };
  logger.info({ tournamentId }, '[Worker] recalculate_season_mmr start');

  const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
  if (!rankedConfig) return;

  const players = await playerMmrRepository.getAllPlayersBySeasonId(tournamentId);

  await mmrCalculationService.recalculateSeasonMmrDeterministic(tournamentId);

  // History was rebuilt: re-sync animation events for the matches whose MMR
  // actually changed (no need to wait for a new match). Batched, no per-event
  // broadcast — a single mmr_recap_ready ping makes clients refetch as one
  // grouped recap.
  await mmrAnimationEventService
    .persistRecalcEvents(tournamentId, players.map((p) => p.playerId))
    .catch((err) => logger.error({ err }, '[Worker] recalc animation event failed'));

  await refreshRankedCaches(tournamentId);

  webSocketService.broadcastToTournament(tournamentId, {
    event: 'mmr_recap_ready',
    data: { seasonId: tournamentId, tournamentId },
  });
  webSocketService.broadcastToTournament(tournamentId, {
    event: 'leaderboard_updated',
    data: { seasonId: tournamentId },
  });

  // A finished season's rewind was computed from the MMR we just rewrote, so it
  // no longer matches reality. Rebuild it — the upsert keeps every player's
  // promotion window and viewed state.
  await regenerateRewindIfFinished(tournamentId);

  logger.info({ tournamentId, playerCount: players.length }, '[Worker] recalculate_season_mmr done');
};

async function regenerateRewindIfFinished(seasonId: string): Promise<void> {
  const season = await tournamentRepository.getById(seasonId);
  if (season?.status !== 'finished') return;
  await enqueueSeasonRewindGeneration(seasonId);
}

const generateSeasonRewind: Task = async (rawPayload) => {
  const { seasonId } = rawPayload as { seasonId: string };
  logger.info({ seasonId }, '[Worker] generate_season_rewind start');

  await seasonRewindService.generateForSeason(seasonId);

  webSocketService.broadcastToTournament(seasonId, {
    event: 'rewind_ready',
    data: { seasonId },
  });

  logger.info({ seasonId }, '[Worker] generate_season_rewind done');
};

export const taskList = {
  finalize_match_mmr: finalizeMatchMmr,
  cancel_match_mmr: cancelMatchMmr,
  recalculate_season_mmr: recalculateSeasonMmr,
  reconcile_pending_badges: reconcilePendingBadges,
  generate_season_rewind: generateSeasonRewind,
};
