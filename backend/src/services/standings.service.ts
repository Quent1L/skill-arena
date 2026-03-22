import { standingsRepository } from "../repository/standings.repository";
import { matchSidesRepository } from "../repository/match-sides.repository";
import { tournamentService } from "./tournament.service";
import { NotFoundError, ForbiddenError, ErrorCode } from "../types/errors";
import {
  type MatchStatus,
  type StandingsEntry,
  type StandingsResult,
} from "@skill-arena/shared";

export class StandingsService {
  /**
   * Calculate official standings (only finalized matches)
   */
  async getOfficialStandings(tournamentId: string): Promise<StandingsResult> {
    return this.calculateStandings(tournamentId, ["finalized"]);
  }

  /**
   * Calculate provisional standings (reported + finalized matches)
   */
  async getProvisionalStandings(tournamentId: string): Promise<StandingsResult> {
    return this.calculateStandings(tournamentId, ["reported", "finalized"]);
  }

  /**
   * Generic standings calculation algorithm
   */
  private async calculateStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ): Promise<StandingsResult> {
    // 1. Get tournament with scoring rules
    const tournament = await standingsRepository.getTournamentWithScoring(
      tournamentId
    );

    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    // 2. Get matches for standings
    const matches = await standingsRepository.getMatchesForStandings(
      tournamentId,
      includeStatuses
    );

    // 3. Get match sides
    const matchSides = await standingsRepository.getMatchSides(
      matches.map((m) => m.id)
    );

    // 4. Initialize standings based on entries
    const standingsMap = await this.initializeEntryStandings(tournamentId, tournament.teamMode);

    // 5. Process each match — sort by playedAt ASC so per-player limits apply chronologically
    const sortedMatches = [...matches].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );

    const matchSidesMap = new Map<string, typeof matchSides>();
    for (const side of matchSides) {
      if (!matchSidesMap.has(side.matchId)) {
        matchSidesMap.set(side.matchId, []);
      }
      matchSidesMap.get(side.matchId)!.push(side);
    }

    // Track how many ranking matches each player has accumulated (flex mode only)
    const playerMatchCount = new Map<string, number>();
    const maxMatchesPerPlayer = tournament.maxMatchesPerPlayer ?? Infinity;

    for (const match of sortedMatches) {
      const sides = matchSidesMap.get(match.id) || [];
      if (sides.length !== 2) continue; // Skip incomplete matches

      const winnerSide = (match.winnerSide === "A" || match.winnerSide === "B") ? match.winnerSide : null;
      this.processMatch(
        sides,
        standingsMap,
        tournament,
        tournament.teamMode,
        winnerSide,
        tournament.scoreEnabled ?? true,
        playerMatchCount,
        maxMatchesPerPlayer,
      );
    }

    // 6. Convert map to array and sort
    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, tournament.scoreEnabled ?? true);

    return { standings };
  }

  /**
   * Initialize standings for all entries in tournament
   */
  private async initializeEntryStandings(
    tournamentId: string,
    teamMode: "static" | "flex"
  ): Promise<Map<string, StandingsEntry>> {
    const standingsMap = new Map<string, StandingsEntry>();

    if (teamMode === "static") {
      // For static teams, standings are by team
      const teams = await standingsRepository.getTournamentTeams(tournamentId);
      for (const team of teams) {
        standingsMap.set(team.id, {
          id: team.id,
          name: team.name,
          shortName: team.name.substring(0, 5).toUpperCase(),
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          scored: 0,
          conceded: 0,
          scoreDiff: 0,
          matchesPlayed: 0,
        });
      }
    } else {
      // For flex mode, standings are by individual player
      // Get all unique players from all entries
      const entries = await standingsRepository.getTournamentEntries(tournamentId);
      const playersMap = new Map<string, { id: string; name: string; shortName: string }>();

      for (const entry of entries) {
        for (const ep of entry.players) {
          if (!playersMap.has(ep.playerId)) {
            playersMap.set(ep.playerId, {
              id: ep.playerId,
              name: ep.player.displayName,
              shortName: ep.player.shortName,
            });
          }
        }
      }

      // Create standings entry for each unique player
      for (const player of playersMap.values()) {
        standingsMap.set(player.id, {
          id: player.id,
          name: player.name,
          shortName: player.shortName,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          scored: 0,
          conceded: 0,
          scoreDiff: 0,
          matchesPlayed: 0,
        });
      }
    }

    return standingsMap;
  }

  /**
   * Process a match (works for both static and flex modes)
   */
  private processMatch(
    sides: Array<{
      matchId: string;
      entryId: string;
      position: number;
      score: number;
      pointsAwarded: number | null;
      entry?: {
        id: string;
        entryType: "PLAYER" | "TEAM";
        teamId?: string | null;
        players: Array<{
          playerId: string;
          player: {
            id: string;
            displayName: string;
          };
        }>;
      };
    }>,
    standingsMap: Map<string, StandingsEntry>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    },
    teamMode: "static" | "flex",
    winnerSide: "A" | "B" | null,
    scoreEnabled: boolean,
    playerMatchCount: Map<string, number> = new Map(),
    maxMatchesPerPlayer: number = Infinity,
  ) {
    if (sides.length !== 2) return;

    const [sideA, sideB] = sides;

    if (teamMode === "static") {
      // Static mode: use team ID
      const entryAId = sideA.entry?.teamId;
      const entryBId = sideB.entry?.teamId;

      if (!entryAId || !entryBId) return;

      const entryA = standingsMap.get(entryAId);
      const entryB = standingsMap.get(entryBId);

      if (!entryA || !entryB) return;

      this.updateStandingsForSide(entryA, sideA, sideB, tournament, winnerSide, scoreEnabled);
      this.updateStandingsForSide(entryB, sideB, sideA, tournament, winnerSide === "A" ? "B" : winnerSide === "B" ? "A" : null, scoreEnabled);
    } else {
      // Flex mode: update each player individually, respecting per-player match limit
      const playersA = sideA.entry?.players || [];
      const playersB = sideB.entry?.players || [];

      // Update stats for each player on side A
      for (const player of playersA) {
        const playerStanding = standingsMap.get(player.playerId);
        if (!playerStanding) continue;

        const priorCount = playerMatchCount.get(player.playerId) ?? 0;
        const countsForRanking = priorCount < maxMatchesPerPlayer;
        if (countsForRanking) {
          this.updateStandingsForPlayer(
            playerStanding,
            sideA.score,
            sideB.score,
            sideA.pointsAwarded,
            tournament,
            winnerSide === "A",
            winnerSide === null,
            scoreEnabled,
          );
          playerMatchCount.set(player.playerId, priorCount + 1);
        } else {
          // Match exceeds limit: only count it as played, no points/W/D/L
          playerStanding.matchesPlayed += 1;
        }
      }

      // Update stats for each player on side B
      for (const player of playersB) {
        const playerStanding = standingsMap.get(player.playerId);
        if (!playerStanding) continue;

        const priorCount = playerMatchCount.get(player.playerId) ?? 0;
        const countsForRanking = priorCount < maxMatchesPerPlayer;
        if (countsForRanking) {
          this.updateStandingsForPlayer(
            playerStanding,
            sideB.score,
            sideA.score,
            sideB.pointsAwarded,
            tournament,
            winnerSide === "B",
            winnerSide === null,
            scoreEnabled,
          );
          playerMatchCount.set(player.playerId, priorCount + 1);
        } else {
          // Match exceeds limit: only count it as played, no points/W/D/L
          playerStanding.matchesPlayed += 1;
        }
      }
    }
  }

  /**
   * Update standings for a side (static mode).
   * isWinner indicates whether this side won the match (derived from match.winnerSide).
   */
  private updateStandingsForSide(
    entry: StandingsEntry,
    side: { score: number; pointsAwarded: number | null },
    opponentSide: { score: number; pointsAwarded: number | null },
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    },
    winnerSide: "A" | "B" | null,
    scoreEnabled: boolean
  ) {
    // Update scores only when scoring is enabled
    if (scoreEnabled) {
      entry.scored += side.score;
      entry.conceded += opponentSide.score;
      entry.scoreDiff = entry.scored - entry.conceded;
    }

    // Determine result from persisted winnerSide
    // winnerSide here is already relative to THIS side:
    //   "A" means this side won, "B" means opponent won, null means draw
    const isDraw = winnerSide === null;
    const wins = winnerSide === "A";

    if (isDraw) {
      entry.draws += 1;
      entry.points += side.pointsAwarded ?? tournament.pointPerDraw ?? 1;
    } else if (wins) {
      entry.wins += 1;
      entry.points += side.pointsAwarded ?? tournament.pointPerVictory ?? 3;
    } else {
      entry.losses += 1;
      entry.points += side.pointsAwarded ?? tournament.pointPerLoss ?? 0;
    }

    entry.matchesPlayed += 1;
  }

  /**
   * Update standings for a player (flex mode).
   * isWinner and isDraw are derived from the persisted match.winnerSide.
   */
  private updateStandingsForPlayer(
    playerStanding: StandingsEntry,
    ownScore: number,
    opponentScore: number,
    pointsAwarded: number | null,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    },
    isWinner: boolean,
    isDraw: boolean,
    scoreEnabled: boolean
  ) {
    // Update scores only when scoring is enabled
    if (scoreEnabled) {
      playerStanding.scored += ownScore;
      playerStanding.conceded += opponentScore;
      playerStanding.scoreDiff = playerStanding.scored - playerStanding.conceded;
    }

    if (isDraw) {
      playerStanding.draws += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerDraw ?? 1;
    } else if (isWinner) {
      playerStanding.wins += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerVictory ?? 3;
    } else {
      playerStanding.losses += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerLoss ?? 0;
    }

    playerStanding.matchesPlayed += 1;
  }

  /**
   * Recalculate and persist pointsAwarded for all reported/finalized matches
   * in a tournament. Cancelled matches are excluded.
   */
  async recalculatePoints(
    tournamentId: string,
    userId: string
  ): Promise<{ updatedMatches: number }> {
    const canManage = await tournamentService.canManageTournament(
      tournamentId,
      userId
    );
    if (!canManage) throw new ForbiddenError(ErrorCode.FORBIDDEN);

    const tournament =
      await standingsRepository.getTournamentWithScoring(tournamentId);
    if (!tournament) throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);

    // Only reported + finalized — cancelled matches are excluded
    const matchList = await standingsRepository.getMatchesForStandings(
      tournamentId,
      ["reported", "finalized"]
    );
    const allSides = await standingsRepository.getMatchSides(
      matchList.map((m) => m.id)
    );

    const sidesMap = new Map<string, typeof allSides>();
    for (const side of allSides) {
      if (!sidesMap.has(side.matchId)) sidesMap.set(side.matchId, []);
      sidesMap.get(side.matchId)!.push(side);
    }

    for (const match of matchList) {
      const sides = sidesMap.get(match.id) ?? [];
      if (sides.length !== 2) continue;

      const [sideA, sideB] = sides;
      // winnerSide is the source of truth (null = draw, "A"/"B" = winner)
      // If allowDraw = false, winnerSide should never be null (validated at creation)
      const isDraw = match.winnerSide === null;
      const isAWinner = match.winnerSide === "A";

      const pointsA = isDraw
        ? (tournament.pointPerDraw ?? 1)
        : isAWinner
          ? (tournament.pointPerVictory ?? 3)
          : (tournament.pointPerLoss ?? 0);
      const pointsB = isDraw
        ? (tournament.pointPerDraw ?? 1)
        : isAWinner
          ? (tournament.pointPerLoss ?? 0)
          : (tournament.pointPerVictory ?? 3);

      await matchSidesRepository.updatePointsAwarded(
        match.id,
        sideA.entryId,
        pointsA
      );
      await matchSidesRepository.updatePointsAwarded(
        match.id,
        sideB.entryId,
        pointsB
      );
    }

    return { updatedMatches: matchList.length };
  }

  /**
   * Sort standings according to tie-breakers.
   * With scores: Points → ScoreDiff → Scored → ID
   * Without scores: Points → Wins → matchesPlayed (asc) → ID
   */
  private sortStandings(standings: StandingsEntry[], scoreEnabled: boolean) {
    standings.sort((a, b) => {
      // 1. Points
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (scoreEnabled) {
        // 2a. Score difference
        if (b.scoreDiff !== a.scoreDiff) {
          return b.scoreDiff - a.scoreDiff;
        }
        // 3a. Scored
        if (b.scored !== a.scored) {
          return b.scored - a.scored;
        }
      } else {
        // 2b. Wins (desc)
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        // 3b. Matches played (asc — fewer matches = better ratio)
        if (a.matchesPlayed !== b.matchesPlayed) {
          return a.matchesPlayed - b.matchesPlayed;
        }
      }

      // Last. Stable sort by id
      return a.id.localeCompare(b.id);
    });
  }
}

export const standingsService = new StandingsService();
