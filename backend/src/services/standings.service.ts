import { standingsRepository } from "../repository/standings.repository";
import { matchSidesRepository } from "../repository/match-sides.repository";
import { tournamentService } from "./tournament.service";
import { NotFoundError, ForbiddenError, ErrorCode } from "../types/errors";
import {
  type MatchStatus,
  type StandingsEntry,
  type StandingsResult,
  type VictoryQualityDetail,
  type StandingsPointsSource,
} from "@skol-arena/shared";
import {
  computeMatchOutcome,
  resolveRankInfo,
  classifyRank,
  winnerSideToPosition,
  type SideOutcomeInput,
} from "./match-outcome.util";

type FlexMatchRow = Awaited<
  ReturnType<typeof standingsRepository.getPlayerPointsForStandings>
>[number];
type StaticMatchRow = Awaited<
  ReturnType<typeof standingsRepository.getMatchesWithSides>
>[number];

interface OutcomeInfo {
  key: string;
  name: string;
  points: number;
}

interface PointsConfig {
  pointPerVictory: number | null;
  pointPerDraw: number | null;
  pointPerLoss: number | null;
  standingsPointsSource: StandingsPointsSource | null;
  rankPoints: number[] | null;
}

type RebuildMatch = { id: string; winnerSide: string | null; playedAt: Date | string };
type RebuildSide = {
  matchId: string;
  entryId: string;
  position: number;
  score: number | null;
  rank: number | null;
  pointsAwarded: number | null;
  entry?: { players: Array<{ playerId: string }> } | null;
};
type PlayerPointRow = {
  matchId: string;
  playerId: string;
  pointsAwarded: number;
  countsForRanking: boolean;
};

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
      this.accumulateFlexBaseStats(match, standingsMap, scoreEnabled);
    }

    // Pass 2: tiebreaker fields
    this.computeFlexTiebreakers(standingsMap, matchRows);

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, allowDraw);
    return { standings };
  }

  private accumulateFlexBaseStats(
    match: FlexMatchRow,
    standingsMap: Map<string, StandingsEntry>,
    scoreEnabled: boolean
  ): void {
    const { positionScore, playerPosition } = this.buildFlexPositionMaps(match.sides);
    const { rankByPosition, rank1Count } = resolveRankInfo(match.sides, winnerSideToPosition(match.winnerSide));

    for (const pp of match.playerPoints) {
      const entry = standingsMap.get(pp.playerId);
      if (!entry || !pp.countsForRanking) continue;

      this.applyFlexPlayerStats(entry, pp.pointsAwarded, {
        rankByPosition,
        rank1Count,
        pos: playerPosition.get(pp.playerId),
        positionScore,
        scoreEnabled,
      });
    }
  }

  private buildFlexPositionMaps(sides: FlexMatchRow["sides"]): {
    positionScore: Map<number, number | null>;
    playerPosition: Map<string, number>;
  } {
    const positionScore = new Map<number, number | null>();
    const playerPosition = new Map<string, number>();
    for (const side of sides) {
      positionScore.set(side.position, side.score);
      for (const ep of side.entry.players) {
        playerPosition.set(ep.playerId, side.position);
      }
    }
    return { positionScore, playerPosition };
  }

  private applyFlexPlayerStats(
    entry: StandingsEntry,
    pointsAwarded: number,
    ctx: {
      rankByPosition: Map<number, number>;
      rank1Count: number;
      pos: number | undefined;
      positionScore: Map<number, number | null>;
      scoreEnabled: boolean;
    }
  ): void {
    entry.matchesPlayed += 1;
    entry.points += pointsAwarded;

    const rank = ctx.pos !== undefined ? ctx.rankByPosition.get(ctx.pos) : undefined;
    const { isWin, isDraw } = classifyRank(rank, ctx.rank1Count);

    if (isDraw) entry.draws += 1;
    else if (isWin) entry.wins += 1;
    else entry.losses += 1;

    if (ctx.scoreEnabled && ctx.pos !== undefined) {
      const ownScore = ctx.positionScore.get(ctx.pos) ?? 0;
      // N-way: "conceded" = best score among the other sides.
      let opponentBest = 0;
      for (const [p, sc] of ctx.positionScore) {
        if (p !== ctx.pos) opponentBest = Math.max(opponentBest, sc ?? 0);
      }
      entry.scored += ownScore;
      entry.conceded += opponentBest;
      entry.scoreDiff = entry.scored - entry.conceded;
    }
  }

  private computeFlexTiebreakers(
    standingsMap: Map<string, StandingsEntry>,
    matchRows: FlexMatchRow[]
  ): void {
    this.initRatioFields(standingsMap);

    const breakdownMap = new Map<string, Map<string, VictoryQualityDetail>>();
    for (const match of matchRows) {
      this.processFlexMatch(match, standingsMap, breakdownMap);
    }

    this.finalizeBreakdowns(standingsMap, breakdownMap);
  }

  private processFlexMatch(
    match: FlexMatchRow,
    standingsMap: Map<string, StandingsEntry>,
    breakdownMap: Map<string, Map<string, VictoryQualityDetail>>
  ): void {
    const outcome = this.outcomeInfo(match.outcomeType, match.outcomeTypeId);
    const { rankByPosition, rank1Count } = resolveRankInfo(match.sides, winnerSideToPosition(match.winnerSide));

    for (const side of match.sides) {
      const { isWin, isDraw } = classifyRank(rankByPosition.get(side.position), rank1Count);
      const sidePlayerIds = side.entry.players.map((ep) => ep.playerId);
      const opponentIds = match.sides
        .filter((s) => s.position !== side.position)
        .flatMap((s) => s.entry.players.map((ep) => ep.playerId));

      for (const pid of sidePlayerIds) {
        this.processFlexPlayer(pid, { isWin, isDraw, opponentIds, match, standingsMap, breakdownMap, outcome });
      }
    }
  }

  private processFlexPlayer(
    playerId: string,
    ctx: {
      isWin: boolean;
      isDraw: boolean;
      opponentIds: string[];
      match: FlexMatchRow;
      standingsMap: Map<string, StandingsEntry>;
      breakdownMap: Map<string, Map<string, VictoryQualityDetail>>;
      outcome: OutcomeInfo;
    }
  ): void {
    const entry = ctx.standingsMap.get(playerId);
    if (!entry) return;

    const pp = ctx.match.playerPoints.find((p) => p.playerId === playerId);
    if (!pp?.countsForRanking) return;

    this.applyVictoryQuality(ctx.breakdownMap, playerId, entry, ctx.outcome, ctx.isWin, !ctx.isDraw && !ctx.isWin);
    this.applyFlexBuchholz(entry, ctx.opponentIds, ctx.standingsMap);
    this.applyHeadToHead(entry, ctx.opponentIds, ctx.isWin, ctx.isDraw);
  }

  // Buchholz: average opponents' points per match (normalizes 2v2, 3v3, etc.)
  private applyFlexBuchholz(
    entry: StandingsEntry,
    opponentIds: string[],
    standingsMap: Map<string, StandingsEntry>
  ): void {
    let oppTotal = 0;
    let counted = 0;
    for (const oppId of opponentIds) {
      const opp = standingsMap.get(oppId);
      if (opp) {
        oppTotal += opp.points;
        counted++;
      }
    }
    if (counted > 0) entry.buchholzScore += oppTotal / counted;
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
      if (sides.length < 2) continue;

      const { rankByPosition, rank1Count } = resolveRankInfo(sides, winnerSideToPosition(match.winnerSide));

      for (const side of sides) {
        const teamId = side.entry?.teamId;
        if (!teamId) continue;
        const entry = standingsMap.get(teamId);
        if (!entry) continue;

        const { isWin, isDraw } = classifyRank(rankByPosition.get(side.position), rank1Count);
        let opponentBest = 0;
        for (const other of sides) {
          if (other.position !== side.position) opponentBest = Math.max(opponentBest, other.score ?? 0);
        }
        this.updateStandingsForSide(entry, side, opponentBest, isWin, isDraw, scoreEnabled, tournament);
      }
    }

    // Pass 2: static tiebreakers
    this.computeStaticTiebreakers(standingsMap, matchRows);

    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings, tournament.allowDraw ?? true);
    return { standings };
  }

  private computeStaticTiebreakers(
    standingsMap: Map<string, StandingsEntry>,
    matchRows: StaticMatchRow[]
  ): void {
    this.initRatioFields(standingsMap);

    const breakdownMap = new Map<string, Map<string, VictoryQualityDetail>>();
    for (const match of matchRows) {
      this.processStaticMatch(match, standingsMap, breakdownMap);
    }

    this.finalizeBreakdowns(standingsMap, breakdownMap);
  }

  private processStaticMatch(
    match: StaticMatchRow,
    standingsMap: Map<string, StandingsEntry>,
    breakdownMap: Map<string, Map<string, VictoryQualityDetail>>
  ): void {
    if (match.sides.length < 2) return;
    const outcome = this.outcomeInfo(match.outcomeType, match.outcomeTypeId);
    const { rankByPosition, rank1Count } = resolveRankInfo(match.sides, winnerSideToPosition(match.winnerSide));

    for (const side of match.sides) {
      const teamId = side.entry?.teamId;
      if (!teamId) continue;
      const entry = standingsMap.get(teamId);
      if (!entry) continue;

      const { isWin, isDraw } = classifyRank(rankByPosition.get(side.position), rank1Count);
      const oppEntries = match.sides
        .filter((s) => s.position !== side.position && s.entry?.teamId && standingsMap.has(s.entry.teamId))
        .map((s) => standingsMap.get(s.entry!.teamId as string)!);
      this.processStaticTeam({ teamId, entry, oppEntries, isWin, isDraw, breakdownMap, outcome });
    }
  }

  private processStaticTeam(args: {
    teamId: string;
    entry: StandingsEntry;
    oppEntries: StandingsEntry[];
    isWin: boolean;
    isDraw: boolean;
    breakdownMap: Map<string, Map<string, VictoryQualityDetail>>;
    outcome: OutcomeInfo;
  }): void {
    const { teamId, entry, oppEntries, isWin, isDraw, breakdownMap, outcome } = args;
    this.applyVictoryQuality(breakdownMap, teamId, entry, outcome, isWin, !isDraw && !isWin);
    // Buchholz: average opponents' points (normalizes N-way matches).
    if (oppEntries.length > 0) {
      entry.buchholzScore += oppEntries.reduce((sum, o) => sum + o.points, 0) / oppEntries.length;
    }
    this.applyHeadToHead(entry, oppEntries.map((o) => o.id), isWin, isDraw);
  }

  // ── Tiebreaker shared helpers ─────────────────────────────────────────

  private initRatioFields(standingsMap: Map<string, StandingsEntry>): void {
    for (const entry of standingsMap.values()) {
      entry.winLossRatio = entry.wins / Math.max(1, entry.losses);
      entry.winRate = entry.wins / Math.max(1, entry.matchesPlayed);
    }
  }

  private finalizeBreakdowns(
    standingsMap: Map<string, StandingsEntry>,
    breakdownMap: Map<string, Map<string, VictoryQualityDetail>>
  ): void {
    for (const [id, breakdown] of breakdownMap) {
      const entry = standingsMap.get(id);
      if (entry) entry.victoryQualityBreakdown = Array.from(breakdown.values());
    }
  }

  private outcomeInfo(
    outcomeType: { points: number | null; name: string | null } | null | undefined,
    outcomeTypeId: string | null
  ): OutcomeInfo {
    return {
      key: outcomeTypeId ?? "default",
      name: outcomeType?.name ?? "Défaut",
      points: outcomeType?.points ?? 3,
    };
  }

  private applyVictoryQuality(
    breakdownMap: Map<string, Map<string, VictoryQualityDetail>>,
    id: string,
    entry: StandingsEntry,
    outcome: OutcomeInfo,
    isWin: boolean,
    isLoss: boolean
  ): void {
    if (!breakdownMap.has(id)) breakdownMap.set(id, new Map());
    const breakdown = breakdownMap.get(id)!;
    if (!breakdown.has(outcome.key)) {
      breakdown.set(outcome.key, { outcomeTypeName: outcome.name, points: outcome.points, wins: 0, losses: 0, contribution: 0 });
    }
    const detail = breakdown.get(outcome.key)!;
    if (isWin) {
      detail.wins++;
      entry.victoryQuality += outcome.points;
    } else if (isLoss) {
      detail.losses++;
      entry.victoryQuality -= outcome.points;
    }
    detail.contribution = (detail.wins - detail.losses) * detail.points;
  }

  private applyHeadToHead(
    entry: StandingsEntry,
    opponentIds: string[],
    isWin: boolean,
    isDraw: boolean
  ): void {
    for (const oppId of opponentIds) {
      if (!entry.headToHead[oppId]) {
        entry.headToHead[oppId] = { wins: 0, draws: 0, losses: 0 };
      }
      const h2h = entry.headToHead[oppId];
      if (isDraw) h2h.draws += 1;
      else if (isWin) h2h.wins += 1;
      else h2h.losses += 1;
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
    opponentBestScore: number,
    isWin: boolean,
    isDraw: boolean,
    scoreEnabled: boolean,
    tournament: { pointPerVictory: number | null; pointPerDraw: number | null; pointPerLoss: number | null }
  ) {
    if (scoreEnabled) {
      entry.scored += side.score ?? 0;
      entry.conceded += opponentBestScore;
      entry.scoreDiff = entry.scored - entry.conceded;
    }

    // Prefer persisted per-side points (computed from the tournament's points source);
    // fall back to win/draw/loss config when not yet persisted.
    const fallback = isDraw
      ? tournament.pointPerDraw ?? 1
      : isWin
        ? tournament.pointPerVictory ?? 3
        : tournament.pointPerLoss ?? 0;
    entry.points += side.pointsAwarded ?? fallback;
    if (isDraw) entry.draws += 1;
    else if (isWin) entry.wins += 1;
    else entry.losses += 1;

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

  // ── Cache ─────────────────────────────────────────────────────────────

  async clearCache(tournamentId: string, userId: string): Promise<void> {
    const canManage = await tournamentService.canManageTournament(tournamentId, userId);
    if (!canManage) throw new ForbiddenError(ErrorCode.FORBIDDEN);
    await standingsRepository.deleteComputedData(tournamentId);
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
      if (sides.length < 2) continue;

      const pts = this.pointsByIndex(sides, match.winnerSide, tournament);
      for (let i = 0; i < sides.length; i++) {
        await matchSidesRepository.updatePointsAwarded(match.id, sides[i].entryId, pts[i]);
      }
    }

    if (tournament.teamMode === "flex") {
      await this.rebuildPlayerPoints(tournamentId, matchList, sidesMap, tournament);
    }

    return { updatedMatches: matchList.length };
  }

  /**
   * Recompute per-side awarded points (by array index = position order). Uses persisted
   * rank/score when present, else derives rank from the stored A/B winner for 2-side matches.
   */
  private pointsByIndex(
    sides: Array<{ score?: number | null; rank?: number | null }>,
    winnerSide: string | null,
    tournament: PointsConfig
  ): number[] {
    const inputs: SideOutcomeInput[] = sides.map((s, i) => ({
      position: i + 1,
      score: s.score ?? null,
      rank: s.rank ?? null,
    }));
    const outcome = computeMatchOutcome(inputs, tournament, winnerSideToPosition(winnerSide));
    const byPosition = new Map(outcome.sides.map((r) => [r.position, r.pointsAwarded]));
    return sides.map((_, i) => byPosition.get(i + 1) ?? 0);
  }

  private async rebuildPlayerPoints(
    tournamentId: string,
    matchList: RebuildMatch[],
    sidesMap: Map<string, RebuildSide[]>,
    tournament: PointsConfig & { maxMatchesPerPlayer: number | null }
  ) {
    const statuses: MatchStatus[] = ["reported", "finalized"];
    await standingsRepository.deletePlayerPointsForTournament(tournamentId, statuses);

    const maxMatches = tournament.maxMatchesPerPlayer ?? Infinity;
    const playerMatchCount = new Map<string, number>();
    const sorted = [...matchList].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );

    const rows: PlayerPointRow[] = [];
    for (const match of sorted) {
      const sides = sidesMap.get(match.id) ?? [];
      if (sides.length < 2) continue;
      this.collectMatchPlayerPoints(match, sides, tournament, { playerMatchCount, maxMatches, rows });
    }

    await standingsRepository.insertPlayerPoints(rows);
  }

  private collectMatchPlayerPoints(
    match: RebuildMatch,
    sides: RebuildSide[],
    tournament: PointsConfig,
    acc: { playerMatchCount: Map<string, number>; maxMatches: number; rows: PlayerPointRow[] }
  ): void {
    const pts = this.pointsByIndex(sides, match.winnerSide, tournament);

    sides.forEach((side, i) => {
      const sidePts = pts[i];

      for (const { playerId } of side.entry?.players ?? []) {
        const prior = acc.playerMatchCount.get(playerId) ?? 0;
        const countsForRanking = prior < acc.maxMatches;
        acc.rows.push({
          matchId: match.id,
          playerId,
          pointsAwarded: countsForRanking ? sidePts : 0,
          countsForRanking,
        });
        if (countsForRanking) acc.playerMatchCount.set(playerId, prior + 1);
      }
    });
  }
}

export const standingsService = new StandingsService();
