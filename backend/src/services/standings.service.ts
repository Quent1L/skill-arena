import { standingsRepository } from "../repository/standings.repository";
import { matchSidesRepository } from "../repository/match-sides.repository";
import { tournamentService } from "./tournament.service";
import { NotFoundError, ForbiddenError, ErrorCode } from "../types/errors";
import {
  type MatchStatus,
  type StandingsEntry,
  type StandingsResult,
  type VictoryQualityDetail,
} from "@skill-arena/shared";

export class StandingsService {
  async getOfficialStandings(tournamentId: string): Promise<StandingsResult> {
    const cached = await standingsRepository.getComputedData(tournamentId, "standings:official");
    if (cached) return cached;
    const result = await this.calculateStandings(tournamentId, ["finalized"]);
    await standingsRepository.setComputedData(tournamentId, "standings:official", result);
    return result;
  }

  async getProvisionalStandings(tournamentId: string): Promise<StandingsResult> {
    const cached = await standingsRepository.getComputedData(tournamentId, "standings:provisional");
    if (cached) return cached;
    const result = await this.calculateStandings(tournamentId, ["reported", "finalized"]);
    await standingsRepository.setComputedData(tournamentId, "standings:provisional", result);
    return result;
  }

  async invalidateCache(tournamentId: string): Promise<void> {
    await standingsRepository.deleteComputedData(tournamentId);
  }

  private async calculateStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[]
  ): Promise<StandingsResult> {
    const tournament = await standingsRepository.getTournamentWithScoring(tournamentId);
    if (!tournament) throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);

    const scoreEnabled = tournament.scoreEnabled ?? true;
    const allowDraw = tournament.allowDraw ?? true;

    if (tournament.teamMode === "flex") {
      return this.calculateFlexStandings(tournamentId, includeStatuses, scoreEnabled, allowDraw);
    }
    return this.calculateStaticStandings(tournamentId, includeStatuses, tournament, scoreEnabled);
  }

  // ── Flex standings ───────────────────────────────────────────────────

  private async calculateFlexStandings(
    tournamentId: string,
    includeStatuses: MatchStatus[],
    scoreEnabled: boolean,
    allowDraw: boolean
  ): Promise<StandingsResult> {
    const standingsMap = await this.initializeFlexStandings(tournamentId);
    const matchRows = await standingsRepository.getPlayerPointsForStandings(
      tournamentId,
      includeStatuses
    );

    // Pass 1: base stats (only countsForRanking matches)
    for (const match of matchRows) {
      const { winnerSide, sides } = match;

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
        if (!pp.countsForRanking) continue;

        entry.matchesPlayed += 1;
        entry.points += pp.pointsAwarded;

        const pos = playerPosition.get(pp.playerId);
        const isDraw = winnerSide === null;
        const isWin = pos === 1 ? winnerSide === "A" : winnerSide === "B";

        if (isDraw) entry.draws += 1;
        else if (isWin) entry.wins += 1;
        else entry.losses += 1;

        if (scoreEnabled && pos !== undefined) {
          const ownScore = positionScore.get(pos) ?? 0;
          const opponentScore = positionScore.get(pos === 1 ? 2 : 1) ?? 0;
          entry.scored += ownScore;
          entry.conceded += opponentScore;
          entry.scoreDiff = entry.scored - entry.conceded;
        }
      }
    }

    // Pass 2: tiebreaker fields
    this.computeFlexTiebreakers(standingsMap, matchRows);

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, allowDraw);
    return { standings };
  }

  private computeFlexTiebreakers(
    standingsMap: Map<string, StandingsEntry>,
    matchRows: Awaited<ReturnType<typeof standingsRepository.getPlayerPointsForStandings>>
  ): void {
    for (const entry of standingsMap.values()) {
      entry.winLossRatio = entry.wins / Math.max(1, entry.losses);
      entry.winRate = entry.wins / Math.max(1, entry.matchesPlayed);
    }

    // outcomeTypeId → breakdown detail per player
    const breakdownMap = new Map<string, Map<string, VictoryQualityDetail>>();

    for (const match of matchRows) {
      const { winnerSide, sides } = match;
      const outcomePoints = match.outcomeType?.points ?? 3;
      const outcomeTypeName = match.outcomeType?.name ?? "Défaut";
      const outcomeKey = match.outcomeTypeId ?? "default";

      // Build side → player ids map
      const sideAPlayerIds: string[] = [];
      const sideBPlayerIds: string[] = [];
      for (const side of sides) {
        const playerIds = side.entry.players.map((ep) => ep.playerId);
        if (side.position === 1) sideAPlayerIds.push(...playerIds);
        else sideBPlayerIds.push(...playerIds);
      }

      const applyQuality = (playerId: string, isWin: boolean, isLoss: boolean) => {
        if (!breakdownMap.has(playerId)) breakdownMap.set(playerId, new Map());
        const playerBreakdown = breakdownMap.get(playerId)!;
        if (!playerBreakdown.has(outcomeKey)) {
          playerBreakdown.set(outcomeKey, { outcomeTypeName, points: outcomePoints, wins: 0, losses: 0, contribution: 0 });
        }
        const detail = playerBreakdown.get(outcomeKey)!;
        const entry = standingsMap.get(playerId);
        if (!entry) return;
        if (isWin) {
          detail.wins++;
          entry.victoryQuality += outcomePoints;
        } else if (isLoss) {
          detail.losses++;
          entry.victoryQuality -= outcomePoints;
        }
        detail.contribution = (detail.wins - detail.losses) * detail.points;
      };

      // Determine player-level outcome
      const processPlayer = (playerId: string, isWin: boolean, isDraw: boolean, opponentIds: string[]) => {
        const entry = standingsMap.get(playerId);
        if (!entry) return;

        const pp = match.playerPoints.find((p) => p.playerId === playerId);
        if (!pp?.countsForRanking) return;

        applyQuality(playerId, isWin, !isDraw && !isWin);

        // Buchholz: average opponents' points per match (normalizes 2v2, 3v3, etc.)
        if (opponentIds.length > 0) {
          let oppTotal = 0;
          let counted = 0;
          for (const oppId of opponentIds) {
            const opp = standingsMap.get(oppId);
            if (opp) { oppTotal += opp.points; counted++; }
          }
          if (counted > 0) entry.buchholzScore += oppTotal / counted;
        }

        // Head-to-head
        for (const oppId of opponentIds) {
          if (!entry.headToHead[oppId]) {
            entry.headToHead[oppId] = { wins: 0, draws: 0, losses: 0 };
          }
          const h2h = entry.headToHead[oppId];
          if (isDraw) h2h.draws += 1;
          else if (isWin) h2h.wins += 1;
          else h2h.losses += 1;
        }
      };

      const isDraw = winnerSide === null;
      for (const pid of sideAPlayerIds) {
        const isWin = winnerSide === "A";
        processPlayer(pid, isWin, isDraw, sideBPlayerIds);
      }
      for (const pid of sideBPlayerIds) {
        const isWin = winnerSide === "B";
        processPlayer(pid, isWin, isDraw, sideAPlayerIds);
      }
    }

    for (const [playerId, playerBreakdown] of breakdownMap) {
      const entry = standingsMap.get(playerId);
      if (entry) entry.victoryQualityBreakdown = Array.from(playerBreakdown.values());
    }
  }

  // ── Static standings ─────────────────────────────────────────────────

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

    // Pass 2: static tiebreakers
    this.computeStaticTiebreakers(standingsMap, matchRows);

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, tournament.allowDraw ?? true);
    return { standings };
  }

  private computeStaticTiebreakers(
    standingsMap: Map<string, StandingsEntry>,
    matchRows: Awaited<ReturnType<typeof standingsRepository.getMatchesWithSides>>
  ): void {
    for (const entry of standingsMap.values()) {
      entry.winLossRatio = entry.wins / Math.max(1, entry.losses);
      entry.winRate = entry.wins / Math.max(1, entry.matchesPlayed);
    }

    // teamId → outcomeKey → breakdown detail
    const breakdownMap = new Map<string, Map<string, VictoryQualityDetail>>();

    for (const match of matchRows) {
      if (match.sides.length !== 2) continue;
      const [sideA, sideB] = match.sides;
      const teamAId = sideA.entry?.teamId;
      const teamBId = sideB.entry?.teamId;
      if (!teamAId || !teamBId) continue;

      const entryA = standingsMap.get(teamAId);
      const entryB = standingsMap.get(teamBId);
      if (!entryA || !entryB) continue;

      const isDraw = match.winnerSide === null;
      const outcomePoints = match.outcomeType?.points ?? 3;
      const outcomeTypeName = match.outcomeType?.name ?? "Défaut";
      const outcomeKey = match.outcomeTypeId ?? "default";

      const applyQuality = (teamId: string, entry: StandingsEntry, isWin: boolean, isLoss: boolean) => {
        if (!breakdownMap.has(teamId)) breakdownMap.set(teamId, new Map());
        const teamBreakdown = breakdownMap.get(teamId)!;
        if (!teamBreakdown.has(outcomeKey)) {
          teamBreakdown.set(outcomeKey, { outcomeTypeName, points: outcomePoints, wins: 0, losses: 0, contribution: 0 });
        }
        const detail = teamBreakdown.get(outcomeKey)!;
        if (isWin) {
          detail.wins++;
          entry.victoryQuality += outcomePoints;
        } else if (isLoss) {
          detail.losses++;
          entry.victoryQuality -= outcomePoints;
        }
        detail.contribution = (detail.wins - detail.losses) * detail.points;
      };

      const processTeam = (teamId: string, entry: StandingsEntry, oppEntry: StandingsEntry, isWin: boolean) => {
        applyQuality(teamId, entry, isWin, !isDraw && !isWin);
        entry.buchholzScore += oppEntry.points;

        if (!entry.headToHead[oppEntry.id]) {
          entry.headToHead[oppEntry.id] = { wins: 0, draws: 0, losses: 0 };
        }
        const h2h = entry.headToHead[oppEntry.id];
        if (isDraw) h2h.draws += 1;
        else if (isWin) h2h.wins += 1;
        else h2h.losses += 1;
      };

      processTeam(teamAId, entryA, entryB, match.winnerSide === "A");
      processTeam(teamBId, entryB, entryA, match.winnerSide === "B");
    }

    for (const [teamId, teamBreakdown] of breakdownMap) {
      const entry = standingsMap.get(teamId);
      if (entry) entry.victoryQualityBreakdown = Array.from(teamBreakdown.values());
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

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
      standingsMap.set(player.id, this.emptyEntry(player.id, player.name, player.shortName));
    }

    return standingsMap;
  }

  private async initializeStaticStandings(
    tournamentId: string
  ): Promise<Map<string, StandingsEntry>> {
    const standingsMap = new Map<string, StandingsEntry>();
    const teams = await standingsRepository.getTournamentTeams(tournamentId);

    for (const team of teams) {
      standingsMap.set(team.id, this.emptyEntry(team.id, team.name, team.name.substring(0, 5).toUpperCase()));
    }

    return standingsMap;
  }

  private emptyEntry(id: string, name: string, shortName: string): StandingsEntry {
    return {
      id, name, shortName,
      points: 0, wins: 0, draws: 0, losses: 0,
      scored: 0, conceded: 0, scoreDiff: 0, matchesPlayed: 0,
      winLossRatio: 0, buchholzScore: 0, victoryQuality: 0, victoryQualityBreakdown: [], winRate: 0,
      headToHead: {},
    };
  }

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

  // ── Sort ─────────────────────────────────────────────────────────────

  private sortStandings(standings: StandingsEntry[], allowDraw: boolean): void {
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (allowDraw && b.winLossRatio !== a.winLossRatio) return b.winLossRatio - a.winLossRatio;
      if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
      return a.id.localeCompare(b.id);
    });

    // H2H is criterion #5; victoryQuality and winRate are fallbacks within tied subgroups
    this.applyHeadToHeadSubgroupSort(standings);
  }

  /**
   * For groups tied on points/wins/ratio/buchholz, re-sort within the group
   * using head-to-head records (H2H wins DESC → H2H winRate DESC).
   */
  private applyHeadToHeadSubgroupSort(standings: StandingsEntry[]): void {
    let groupStart = 0;
    while (groupStart < standings.length) {
      let groupEnd = groupStart + 1;
      const ref = standings[groupStart];

      while (
        groupEnd < standings.length &&
        standings[groupEnd].points === ref.points &&
        standings[groupEnd].wins === ref.wins &&
        standings[groupEnd].winLossRatio === ref.winLossRatio &&
        standings[groupEnd].buchholzScore === ref.buchholzScore
      ) {
        groupEnd++;
      }

      if (groupEnd - groupStart > 1) {
        const group = standings.slice(groupStart, groupEnd);
        this.sortGroupByH2H(group);
        for (let i = 0; i < group.length; i++) {
          standings[groupStart + i] = group[i];
        }
      }

      groupStart = groupEnd;
    }
  }

  private sortGroupByH2H(group: StandingsEntry[]): void {
    const ids = new Set(group.map((e) => e.id));

    // Compute H2H stats within the subgroup only
    const h2hWins = new Map<string, number>();
    const h2hPlayed = new Map<string, number>();

    for (const entry of group) {
      let wins = 0;
      let played = 0;
      for (const [oppId, rec] of Object.entries(entry.headToHead)) {
        if (!ids.has(oppId)) continue;
        wins += rec.wins;
        played += rec.wins + rec.draws + rec.losses;
      }
      h2hWins.set(entry.id, wins);
      h2hPlayed.set(entry.id, played);
    }

    group.sort((a, b) => {
      const winsA = h2hWins.get(a.id) ?? 0;
      const winsB = h2hWins.get(b.id) ?? 0;
      if (winsB !== winsA) return winsB - winsA;

      const playedA = h2hPlayed.get(a.id) ?? 0;
      const playedB = h2hPlayed.get(b.id) ?? 0;
      const rateA = winsA / Math.max(1, playedA);
      const rateB = winsB / Math.max(1, playedB);
      if (rateB !== rateA) return rateB - rateA;

      // Fall through to quality/winRate already computed
      if (b.victoryQuality !== a.victoryQuality) return b.victoryQuality - a.victoryQuality;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.id.localeCompare(b.id);
    });
  }

  // ── Recalculate ──────────────────────────────────────────────────────

  async recalculatePoints(
    tournamentId: string,
    userId: string
  ): Promise<{ updatedMatches: number }> {
    const canManage = await tournamentService.canManageTournament(tournamentId, userId);
    if (!canManage) throw new ForbiddenError(ErrorCode.FORBIDDEN);

    return this.recalculatePointsInternal(tournamentId);
  }

  async recalculatePointsInternal(
    tournamentId: string
  ): Promise<{ updatedMatches: number }> {
    // Invalidate cache so next request recomputes fresh
    await standingsRepository.deleteComputedData(tournamentId);

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

    if (tournament.teamMode === "flex") {
      await this.rebuildPlayerPoints(tournamentId, matchList, sidesMap, tournament);
    }

    return { updatedMatches: matchList.length };
  }

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
}

export const standingsService = new StandingsService();
