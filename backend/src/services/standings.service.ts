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
   * Generic standings calculation
   */
  private async calculateStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ): Promise<StandingsResult> {
    const tournament = await standingsRepository.getTournamentWithScoring(tournamentId);
    if (!tournament) throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);

    const scoreEnabled = tournament.scoreEnabled ?? true;

    if (tournament.teamMode === "flex") {
      return this.calculateFlexStandings(tournamentId, includeStatuses, tournament, scoreEnabled);
    }
    return this.calculateStaticStandings(tournamentId, includeStatuses, tournament, scoreEnabled);
  }

  /**
   * Flex standings: use matchPlayerPoints (persisted per-player data)
   */
  private async calculateFlexStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[],
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      scoreEnabled: boolean | null;
      maxMatchesPerPlayer: number | null;
    },
    scoreEnabled: boolean
  ): Promise<StandingsResult> {
    // Initialize standings for all players
    const standingsMap = await this.initializeFlexStandings(tournamentId);

    // Fetch match data with per-player points + side info for W/D/L/scores
    const matchRows = await standingsRepository.getPlayerPointsForStandings(
      tournamentId,
      includeStatuses
    );

    for (const match of matchRows) {
      const { winnerSide, sides } = match;

      // Build position→score map and player→position map for this match
      const positionScore = new Map<number, number | null>();
      const playerPosition = new Map<string, number>();
      for (const side of sides) {
        positionScore.set(side.position, side.score);
        for (const ep of side.entry.players) {
          playerPosition.set(ep.playerId, side.position);
        }
      }

      for (const pp of match.playerPoints) {
        const entry = standingsMap.get(pp.playerId);
        if (!entry) continue;

        entry.matchesPlayed += 1;
        if (!pp.countsForRanking) continue;

        entry.points += pp.pointsAwarded;

        // W/D/L from winnerSide + position
        const pos = playerPosition.get(pp.playerId);
        const isDraw = winnerSide === null;
        const isWin = pos === 1 ? winnerSide === "A" : winnerSide === "B";

        if (isDraw) entry.draws += 1;
        else if (isWin) entry.wins += 1;
        else entry.losses += 1;

        // Scores
        if (scoreEnabled && pos !== undefined) {
          const ownScore = positionScore.get(pos) ?? 0;
          const opponentScore = positionScore.get(pos === 1 ? 2 : 1) ?? 0;
          entry.scored += ownScore;
          entry.conceded += opponentScore;
          entry.scoreDiff = entry.scored - entry.conceded;
        }
      }
    }

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, scoreEnabled);
    return { standings };
  }

  /**
   * Static standings: use matchSides + single combined query
   */
  private async calculateStaticStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[],
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    },
    scoreEnabled: boolean
  ): Promise<StandingsResult> {
    const standingsMap = await this.initializeStaticStandings(tournamentId);

    const matchRows = await standingsRepository.getMatchesWithSides(
      tournamentId,
      includeStatuses
    );

    for (const match of matchRows) {
      const sides = match.sides;
      if (sides.length !== 2) continue;

      const [sideA, sideB] = sides;
      const winnerSide = (match.winnerSide === "A" || match.winnerSide === "B")
        ? match.winnerSide
        : null;

      const entryAId = sideA.entry?.teamId;
      const entryBId = sideB.entry?.teamId;
      if (!entryAId || !entryBId) continue;

      const entryA = standingsMap.get(entryAId);
      const entryB = standingsMap.get(entryBId);
      if (!entryA || !entryB) continue;

      this.updateStandingsForSide(entryA, sideA, sideB, tournament, winnerSide, scoreEnabled);
      this.updateStandingsForSide(
        entryB, sideB, sideA, tournament,
        winnerSide === "A" ? "B" : winnerSide === "B" ? "A" : null,
        scoreEnabled
      );
    }

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, scoreEnabled);
    return { standings };
  }

  /**
   * Initialize standings map for flex (per-player)
   */
  private async initializeFlexStandings(
    tournamentId: string
  ): Promise<Map<string, StandingsEntry>> {
    const standingsMap = new Map<string, StandingsEntry>();
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

    for (const player of playersMap.values()) {
      standingsMap.set(player.id, {
        id: player.id,
        name: player.name,
        shortName: player.shortName,
        points: 0, wins: 0, draws: 0, losses: 0,
        scored: 0, conceded: 0, scoreDiff: 0, matchesPlayed: 0,
      });
    }

    return standingsMap;
  }

  /**
   * Initialize standings map for static (per-team)
   */
  private async initializeStaticStandings(
    tournamentId: string
  ): Promise<Map<string, StandingsEntry>> {
    const standingsMap = new Map<string, StandingsEntry>();
    const teams = await standingsRepository.getTournamentTeams(tournamentId);

    for (const team of teams) {
      standingsMap.set(team.id, {
        id: team.id,
        name: team.name,
        shortName: team.name.substring(0, 5).toUpperCase(),
        points: 0, wins: 0, draws: 0, losses: 0,
        scored: 0, conceded: 0, scoreDiff: 0, matchesPlayed: 0,
      });
    }

    return standingsMap;
  }

  /**
   * Update standings for a side (static mode)
   */
  private updateStandingsForSide(
    entry: StandingsEntry,
    side: { score: number | null; pointsAwarded: number | null },
    opponentSide: { score: number | null; pointsAwarded: number | null },
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    },
    winnerSide: "A" | "B" | null,
    scoreEnabled: boolean
  ) {
    if (scoreEnabled) {
      entry.scored += side.score ?? 0;
      entry.conceded += opponentSide.score ?? 0;
      entry.scoreDiff = entry.scored - entry.conceded;
    }

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
   * Recalculate and persist pointsAwarded for all reported/finalized matches.
   * For flex tournaments: also rebuilds matchPlayerPoints (per-player, match-limit-aware).
   */
  async recalculatePoints(
    tournamentId: string,
    userId: string
  ): Promise<{ updatedMatches: number }> {
    const canManage = await tournamentService.canManageTournament(tournamentId, userId);
    if (!canManage) throw new ForbiddenError(ErrorCode.FORBIDDEN);

    return this.recalculatePointsInternal(tournamentId);
  }

  /**
   * Internal recalculation without auth check — called automatically on match finalization/reporting
   */
  async recalculatePointsInternal(
    tournamentId: string
  ): Promise<{ updatedMatches: number }> {
    const tournament = await standingsRepository.getTournamentWithScoring(tournamentId);
    if (!tournament) throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);

    const statuses: MatchStatus[] = ["reported", "finalized"];

    const matchList = await standingsRepository.getMatchesForStandings(tournamentId, statuses);
    const allSides = await standingsRepository.getMatchSides(matchList.map((m) => m.id));

    const sidesMap = new Map<string, typeof allSides>();
    for (const side of allSides) {
      if (!sidesMap.has(side.matchId)) sidesMap.set(side.matchId, []);
      sidesMap.get(side.matchId)!.push(side);
    }

    // Recalculate matchSides.pointsAwarded for all modes
    for (const match of matchList) {
      const sides = sidesMap.get(match.id) ?? [];
      if (sides.length !== 2) continue;

      const [sideA, sideB] = sides;
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

      await matchSidesRepository.updatePointsAwarded(match.id, sideA.entryId, pointsA);
      await matchSidesRepository.updatePointsAwarded(match.id, sideB.entryId, pointsB);
    }

    // For flex tournaments: rebuild per-player matchPlayerPoints
    if (tournament.teamMode === "flex") {
      await this.rebuildPlayerPoints(
        tournamentId,
        matchList,
        sidesMap,
        tournament
      );
    }

    return { updatedMatches: matchList.length };
  }

  /**
   * Rebuild matchPlayerPoints for a flex tournament.
   * Sorts by playedAt ASC, tracks per-player match count, sets countsForRanking accordingly.
   */
  private async rebuildPlayerPoints(
    tournamentId: string,
    matchList: Array<{ id: string; winnerSide: string | null; playedAt: Date | string }>,
    sidesMap: Map<string, Array<{
      matchId: string;
      entryId: string;
      pointsAwarded: number | null;
      entry?: {
        players: Array<{ playerId: string }>;
      } | null;
    }>>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      maxMatchesPerPlayer: number | null;
    }
  ) {
    const statuses: MatchStatus[] = ["reported", "finalized"];
    await standingsRepository.deletePlayerPointsForTournament(tournamentId, statuses);

    const maxMatches = tournament.maxMatchesPerPlayer ?? Infinity;
    const playerMatchCount = new Map<string, number>();

    // Sort chronologically for correct limit tracking
    const sorted = [...matchList].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );

    const rows: Array<{
      matchId: string;
      playerId: string;
      pointsAwarded: number;
      countsForRanking: boolean;
    }> = [];

    for (const match of sorted) {
      const sides = sidesMap.get(match.id) ?? [];
      if (sides.length !== 2) continue;

      const isDraw = match.winnerSide === null;
      const isAWinner = match.winnerSide === "A";

      const standardPoints = (side: "A" | "B") => {
        const isWin = side === "A" ? isAWinner : !isAWinner && !isDraw;
        if (isDraw) return tournament.pointPerDraw ?? 1;
        if (isWin) return tournament.pointPerVictory ?? 3;
        return tournament.pointPerLoss ?? 0;
      };

      for (const side of sides) {
        const sideLabel = side === sides[0] ? "A" : "B";
        const pts = standardPoints(sideLabel as "A" | "B");
        const players = side.entry?.players ?? [];

        for (const { playerId } of players) {
          const prior = playerMatchCount.get(playerId) ?? 0;
          const countsForRanking = prior < maxMatches;
          rows.push({
            matchId: match.id,
            playerId,
            pointsAwarded: countsForRanking ? pts : 0,
            countsForRanking,
          });
          if (countsForRanking) {
            playerMatchCount.set(playerId, prior + 1);
          }
        }
      }
    }

    await standingsRepository.insertPlayerPoints(rows);
  }

  /**
   * Sort standings according to tie-breakers.
   * With scores: Points → ScoreDiff → Scored → ID
   * Without scores: Points → Wins → matchesPlayed (asc) → ID
   */
  private sortStandings(standings: StandingsEntry[], scoreEnabled: boolean) {
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      if (scoreEnabled) {
        if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
        if (b.scored !== a.scored) return b.scored - a.scored;
      } else {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.matchesPlayed !== b.matchesPlayed) return a.matchesPlayed - b.matchesPlayed;
      }

      return a.id.localeCompare(b.id);
    });
  }
}

export const standingsService = new StandingsService();
