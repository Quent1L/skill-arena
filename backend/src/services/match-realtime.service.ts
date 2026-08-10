import { matchRepository } from "../repository/match.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { logger } from "../utils/logger";
import { webSocketService } from "./websocket.service";

/**
 * Live updates for a single match. Everything that changes the state of a match —
 * a report, a correction, a validation, a dispute, a finalization — is pushed to the
 * people looking at it, so a page open on the match never shows a stale status.
 *
 * The payload carries no match data on purpose: clients refetch through the API, which
 * keeps a single place deciding what each of them is allowed to see.
 */
export class MatchRealtimeService {
  /**
   * Participants and the tournament organizers: the same audience that may read the
   * match thread.
   */
  async resolveAudience(matchId: string, tournamentId: string): Promise<string[]> {
    const participants = await matchRepository.getParticipationsByMatchId(matchId);
    const admins = await tournamentRepository.getAdminUserIds(tournamentId);
    return [...new Set([...participants.map((p) => p.playerId), ...admins])];
  }

  /**
   * Never throws: a broken socket must not roll back the action it reports.
   */
  async notifyMatchUpdated(matchId: string): Promise<void> {
    try {
      const match = await matchRepository.getById(matchId);
      if (!match) return;

      const audience = await this.resolveAudience(matchId, match.tournamentId);
      for (const userId of audience) {
        webSocketService.send(userId, {
          event: "match_updated",
          data: { matchId, status: match.status },
        });
      }
    } catch (error) {
      logger.error({ err: error, matchId }, "Failed to broadcast match update");
    }
  }
}

export const matchRealtimeService = new MatchRealtimeService();
