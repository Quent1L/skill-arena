import { standingsRepository } from "../repository/standings.repository";
import { playerStatsRepository } from "../repository/player-stats.repository";
import { playerComputedDataRepository } from "../repository/player-computed-data.repository";

export class PlayerCacheService {
  /**
   * Standings, leaderboards and tournament stats bake player names into their JSONB
   * payload, and a player's cached stats embed the names of their partners, nemeses
   * and head-to-head opponents. A rename therefore has to drop every cache the player
   * appears in, including the caches belonging to everyone they played with or against.
   *
   * All of these caches are read-through, so deleting a row only costs a recompute on
   * the next read.
   */
  async invalidateDenormalizedNames(playerIds: string[]): Promise<void> {
    if (playerIds.length === 0) return;

    const tournamentIds = await playerStatsRepository.getTournamentIdsByPlayers(playerIds);

    await standingsRepository.deleteComputedDataMany(tournamentIds);

    const coPlayerIds = await playerStatsRepository.getPlayerIdsByTournaments(tournamentIds);
    await playerComputedDataRepository.deleteMany([...new Set([...playerIds, ...coPlayerIds])]);
  }
}

export const playerCacheService = new PlayerCacheService();
