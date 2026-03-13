import { db } from "../config/database";
import { eq, and, asc } from "drizzle-orm";
import { matches, matchSides, tournaments, rankedSeasonConfigs, outcomeTypes, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";

export class MmrCalculationService {
  /**
   * Expected score using Elo formula
   */
  calculateExpectedScore(playerMmr: number, opponentMmr: number): number {
    return 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
  }

  /**
   * Effective K factor with placement and score multiplier
   */
  calculateEffectiveK(
    kBase: number,
    scoreA: number,
    scoreB: number,
    isPlacement: boolean,
    scoreCountsForMmr: boolean,
  ): number {
    let k = kBase;
    if (isPlacement) k *= 2;

    if (scoreCountsForMmr) {
      const total = scoreA + scoreB;
      if (total > 0) {
        const winner = Math.max(scoreA, scoreB);
        const loser = Math.min(scoreA, scoreB);
        k = k * (1 + (winner - loser) / total);
      }
    }

    return k;
  }

  /**
   * Calculate MMR delta for a player
   */
  calculateMmrDelta(
    playerMmr: number,
    oppAvgMmr: number,
    result: 1 | 0 | 0.5,
    kEffective: number,
  ): number {
    const expected = this.calculateExpectedScore(playerMmr, oppAvgMmr);
    return Math.round(kEffective * (result - expected));
  }

  /**
   * Recalculate MMR for a single player by replaying all finalized ranked matches
   */
  async recalculatePlayerMmr(seasonId: string, playerId: string): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    if (!config) return;

    // Delete existing history and reset MMR
    await playerMmrRepository.deleteMmrHistoryForPlayer(seasonId, playerId);

    const history = await playerMmrRepository.getMmrHistoryOrdered(seasonId, playerId);
    // history is now empty, we'll rebuild from matches

    // Get all finalized matches for this player in this season, ordered by playedAt
    const playerMatches = await this.getPlayerMatchesForSeason(seasonId, playerId);

    let currentMmr = config.baseMmr;
    let wins = 0;
    let losses = 0;
    let winStreak = 0;
    let maxWinStreak = 0;

    for (const match of playerMatches) {
      const matchesPlayedSoFar = wins + losses;
      const isPlacement = matchesPlayedSoFar < config.placementMatches;

      const { opponentPlayerIds, scoreForPlayer, scoreForOpponent, playerWon } =
        await this.extractMatchSidesForPlayer(match.id, playerId);

      const scoreCountsForMmr = match.outcomeType?.scoreCountsForMmr ?? true;

      const oppMmrs = await Promise.all(
        opponentPlayerIds.map(async (oppId) => {
          const oppMmr = await playerMmrRepository.getBySeasonAndPlayer(seasonId, oppId);
          return oppMmr?.currentMmr ?? config.baseMmr;
        }),
      );

      const opponentAvgMmr =
        oppMmrs.length > 0
          ? Math.round(oppMmrs.reduce((a, b) => a + b, 0) / oppMmrs.length)
          : config.baseMmr;

      const result: 1 | 0 | 0.5 = playerWon === null ? 0.5 : playerWon ? 1 : 0;

      const kEffective = this.calculateEffectiveK(
        config.kFactor,
        scoreForPlayer,
        scoreForOpponent,
        isPlacement,
        scoreCountsForMmr,
      );

      const delta = this.calculateMmrDelta(currentMmr, opponentAvgMmr, result, kEffective);
      const mmrBefore = currentMmr;
      currentMmr = Math.max(1, currentMmr + delta);

      if (playerWon === true) {
        wins++;
        winStreak++;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else if (playerWon === false) {
        losses++;
        winStreak = 0;
      }

      await playerMmrRepository.createMmrHistory({
        seasonId,
        playerId,
        matchId: match.id,
        mmrBefore,
        mmrAfter: currentMmr,
        mmrDelta: delta,
        kEffective,
        opponentAvgMmr,
        isPlacement,
      });
    }

    await playerMmrRepository.upsert({
      seasonId,
      playerId,
      currentMmr,
      matchesPlayed: wins + losses,
      wins,
      losses,
      winStreak,
      maxWinStreak,
    });
  }

  /**
   * Process MMR after a match is finalized
   */
  async processMatchFinalization(matchId: string): Promise<void> {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        tournament: {
          with: {
            rankedConfig: true,
          },
        },
      },
    });

    if (!match || match.tournament?.mode !== "ranked") return;

    const seasonId = match.tournamentId;
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      await this.ensurePlayerMmrExists(seasonId, match.tournament.rankedConfig?.baseMmr ?? 1000, playerId);
      await this.recalculatePlayerMmr(seasonId, playerId);
    }
  }

  /**
   * Get all finalized matches for a player in a season, ordered by playedAt
   */
  private async getPlayerMatchesForSeason(seasonId: string, playerId: string) {
    const playerMatchIds = await db
      .select({ matchId: matchSides.matchId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(eq(tournamentEntryPlayers.playerId, playerId));

    const ids = playerMatchIds.map((r) => r.matchId);
    if (ids.length === 0) return [];

    const { inArray } = await import("drizzle-orm");

    return await db.query.matches.findMany({
      where: and(
        eq(matches.tournamentId, seasonId),
        eq(matches.status, "finalized"),
        inArray(matches.id, ids),
      ),
      with: {
        outcomeType: true,
      },
      orderBy: (m, { asc }) => [asc(m.playedAt)],
    });
  }

  /**
   * Extract match sides info for a specific player
   */
  private async extractMatchSidesForPlayer(
    matchId: string,
    playerId: string,
  ): Promise<{
    opponentPlayerIds: string[];
    scoreForPlayer: number;
    scoreForOpponent: number;
    playerWon: boolean | null;
  }> {
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
      orderBy: (s, { asc }) => [asc(s.position)],
      with: {
        entry: {
          with: {
            players: {
              with: {
                player: true,
              },
            },
          },
        },
      },
    });

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });

    if (!match || sides.length < 2) {
      return { opponentPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };
    }

    const sideA = sides[0];
    const sideB = sides[1];

    const playerIdsA = sideA.entry?.players.map((p: any) => p.playerId) ?? [];
    const playerIdsB = sideB.entry?.players.map((p: any) => p.playerId) ?? [];

    const playerInSideA = playerIdsA.includes(playerId);
    const mySide = playerInSideA ? sideA : sideB;
    const oppSide = playerInSideA ? sideB : sideA;
    const opponentPlayerIds = playerInSideA ? playerIdsB : playerIdsA;

    const winnerSide = match.winnerSide;
    let playerWon: boolean | null = null;
    if (winnerSide === "A") {
      playerWon = playerInSideA;
    } else if (winnerSide === "B") {
      playerWon = !playerInSideA;
    }

    return {
      opponentPlayerIds,
      scoreForPlayer: mySide.score,
      scoreForOpponent: oppSide.score,
      playerWon,
    };
  }

  /**
   * Get all player IDs in a match
   */
  private async getMatchPlayerIds(matchId: string): Promise<string[]> {
    const rows = await db
      .select({ playerId: tournamentEntryPlayers.playerId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(eq(matchSides.matchId, matchId));

    return [...new Set(rows.map((r) => r.playerId))];
  }

  /**
   * Ensure a player_mmr record exists for a season (auto-register with baseMmr)
   */
  private async ensurePlayerMmrExists(
    seasonId: string,
    baseMmr: number,
    playerId: string,
  ): Promise<void> {
    const existing = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
    if (!existing) {
      await playerMmrRepository.upsert({
        seasonId,
        playerId,
        currentMmr: baseMmr,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
      });
    }
  }
}

export const mmrCalculationService = new MmrCalculationService();
