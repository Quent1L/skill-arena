import { tournamentStatsRepository } from "../repository/tournament-stats.repository";
import { NotFoundError, ErrorCode } from "../types/errors";
import { rankByWeightedRate, TOP_WEIGHTED_RATE } from "./stats-ranking";
import type {
  TournamentStats,
  OutcomeTypeCount,
  BestTeamEntry,
  WinStreakEntry,
  BestDuoEntry,
  OutcomeTypeFunStat,
  OutcomeTypeLeader,
} from "@skol-arena/shared";

type MatchData = Awaited<
  ReturnType<typeof tournamentStatsRepository.getMatchesWithSidesAndPlayers>
>[number];

function isWinner(side: MatchData["sides"][number], winnerSide: string | null): boolean {
  if (!winnerSide) return false;
  return (side.position === 1 && winnerSide === "A") || (side.position === 2 && winnerSide === "B");
}

function isLoser(side: MatchData["sides"][number], winnerSide: string | null): boolean {
  if (!winnerSide) return false;
  return (side.position === 1 && winnerSide === "B") || (side.position === 2 && winnerSide === "A");
}

type PlayerWLStats = {
  displayName: string;
  shortName: string;
  wins: number;
  losses: number;
  played: number;
};

type PlayerRef = { id: string; displayName: string; shortName: string };

function recordPlayerResult(
  stats: Map<string, PlayerWLStats>,
  player: PlayerRef,
  won: boolean,
  lost: boolean,
): void {
  const { id, displayName, shortName } = player;
  if (!stats.has(id)) {
    stats.set(id, { displayName, shortName, wins: 0, losses: 0, played: 0 });
  }
  const s = stats.get(id)!;
  s.played++;
  if (won) s.wins++;
  if (lost) s.losses++;
}

function rankBestPlayers(stats: Map<string, PlayerWLStats>): BestDuoEntry[] {
  return Array.from(stats.entries())
    .filter(([, s]) => s.played >= 2)
    .map(([playerId, s]) => ({
      playerId,
      displayName: s.displayName,
      shortName: s.shortName,
      wins: s.wins,
      losses: s.losses,
      matchesPlayed: s.played,
      winRate: s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
    .slice(0, 5);
}

function accumulateSides(
  sides: MatchData["sides"],
  winnerSide: string | null,
  stats: Map<string, PlayerWLStats>,
): void {
  for (const side of sides) {
    const won = isWinner(side, winnerSide);
    const lost = isLoser(side, winnerSide);
    for (const ep of side.entry.players) {
      if (ep.player) recordPlayerResult(stats, ep.player, won, lost);
    }
  }
}

type ResultCollector<T> = {
  displayName: string;
  shortName: string;
  results: T[];
};

function collectPlayerResults<T>(
  matchesData: MatchData[],
  makeResult: (match: MatchData, side: MatchData["sides"][number]) => T,
): Map<string, ResultCollector<T>> {
  const map = new Map<string, ResultCollector<T>>();
  for (const match of matchesData) {
    for (const side of match.sides) {
      for (const ep of side.entry.players) {
        if (!ep.player) continue;
        const { id, displayName, shortName } = ep.player;
        if (!map.has(id)) map.set(id, { displayName, shortName, results: [] });
        map.get(id)!.results.push(makeResult(match, side));
      }
    }
  }
  return map;
}

function computeBestTeams(matchesData: MatchData[]): BestTeamEntry[] {
  const entryStats = new Map<
    string,
    { displayName: string; wins: number; losses: number; draws: number; playerCount: number }
  >();

  for (const match of matchesData) {
    for (const side of match.sides) {
      const entryId = side.entry.id;
      const playerNames = side.entry.players.map((p) => p.player?.displayName ?? "?");
      const displayName = playerNames.join(" / ");

      if (!entryStats.has(entryId)) {
        entryStats.set(entryId, { displayName, wins: 0, losses: 0, draws: 0, playerCount: side.entry.players.length });
      }
      const stats = entryStats.get(entryId)!;

      if (!match.winnerSide) {
        stats.draws++;
      } else if (isWinner(side, match.winnerSide)) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }
  }

  return Array.from(entryStats.entries())
    .filter(([, s]) => s.playerCount > 1)
    .map(([entryId, s]) => {
      const matchesPlayed = s.wins + s.losses + s.draws;
      return {
        entryId,
        displayName: s.displayName,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        matchesPlayed,
        winRate: matchesPlayed > 0 ? Math.round((s.wins / matchesPlayed) * 100) : 0,
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
    .slice(0, 3);
}

function computeWinStreaks(matchesData: MatchData[]): WinStreakEntry[] {
  const playerMatches = collectPlayerResults(matchesData, (match, side) => ({
    playedAt: new Date(match.playedAt),
    won: isWinner(side, match.winnerSide),
  }));

  const streaks: WinStreakEntry[] = [];
  for (const [playerId, data] of playerMatches) {
    const sorted = [...data.results].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
    let streak = 0;
    for (const r of sorted) {
      if (!r.won) break;
      streak++;
    }
    if (streak >= 2) {
      streaks.push({ playerId, displayName: data.displayName, shortName: data.shortName, currentStreak: streak });
    }
  }

  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

function computeLossStreaks(matchesData: MatchData[]): WinStreakEntry[] {
  const playerMatches = collectPlayerResults(matchesData, (match, side) => ({
    playedAt: new Date(match.playedAt),
    lost: isLoser(side, match.winnerSide),
  }));

  const streaks: WinStreakEntry[] = [];
  for (const [playerId, data] of playerMatches) {
    const sorted = [...data.results].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
    let streak = 0;
    for (const r of sorted) {
      if (!r.lost) break;
      streak++;
    }
    if (streak >= 2) {
      streaks.push({ playerId, displayName: data.displayName, shortName: data.shortName, currentStreak: streak });
    }
  }

  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

function computeSymmetricPlayers(matchesData: MatchData[], teamSize: number): BestDuoEntry[] {
  const playerStats = new Map<string, PlayerWLStats>();

  for (const match of matchesData) {
    const sideA = match.sides.find((s) => s.position === 1);
    const sideB = match.sides.find((s) => s.position === 2);
    if (!sideA || !sideB) continue;
    if (sideA.entry.players.length !== teamSize || sideB.entry.players.length !== teamSize) continue;

    accumulateSides([sideA, sideB], match.winnerSide, playerStats);
  }

  return rankBestPlayers(playerStats);
}

function computeBestDuoPlayers(matchesData: MatchData[]): BestDuoEntry[] {
  return computeSymmetricPlayers(matchesData, 2);
}

function computeBestSoloPlayers(matchesData: MatchData[]): BestDuoEntry[] {
  return computeSymmetricPlayers(matchesData, 1);
}

function computeBestAsymmetricSoloPlayers(matchesData: MatchData[]): BestDuoEntry[] {
  const playerStats = new Map<string, PlayerWLStats>();

  for (const match of matchesData) {
    const sideA = match.sides.find((s) => s.position === 1);
    const sideB = match.sides.find((s) => s.position === 2);
    if (!sideA || !sideB) continue;
    if (sideA.entry.players.length === sideB.entry.players.length) continue;

    for (const side of [sideA, sideB]) {
      if (side.entry.players.length !== 1) continue;
      const ep = side.entry.players[0];
      if (!ep.player) continue;
      recordPlayerResult(
        playerStats,
        ep.player,
        isWinner(side, match.winnerSide),
        isLoser(side, match.winnerSide),
      );
    }
  }

  return rankBestPlayers(playerStats);
}

function computeBestInvincibleStreak(matchesData: MatchData[]): WinStreakEntry[] {
  const playerMatches = collectPlayerResults(matchesData, (match, side) => ({
    playedAt: new Date(match.playedAt),
    notLost: !isLoser(side, match.winnerSide),
  }));

  const streaks: WinStreakEntry[] = [];
  for (const [playerId, data] of playerMatches) {
    const sorted = [...data.results].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
    let best = 0, current = 0;
    for (const r of sorted) {
      if (r.notLost) { current++; best = Math.max(best, current); }
      else current = 0;
    }
    if (best >= 3) streaks.push({ playerId, displayName: data.displayName, shortName: data.shortName, currentStreak: best });
  }

  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

type OutcomeTypePlayerAcc = {
  displayName: string;
  shortName: string;
  wins: number;
  losses: number;
  played: number;
};

type OutcomeTypeAcc = {
  name: string;
  totalMatches: number;
  players: Map<string, OutcomeTypePlayerAcc>;
};

function recordOutcomeTypeResult(
  players: Map<string, OutcomeTypePlayerAcc>,
  player: PlayerRef,
  won: boolean,
  lost: boolean,
): void {
  const { id, displayName, shortName } = player;
  if (!players.has(id)) {
    players.set(id, { displayName, shortName, wins: 0, losses: 0, played: 0 });
  }
  const acc = players.get(id)!;
  // Draws count as played but neither won nor lost: they belong in the rate denominator.
  acc.played++;
  if (won) acc.wins++;
  if (lost) acc.losses++;
}

function countOutcomePlayers(match: MatchData, entry: OutcomeTypeAcc): void {
  for (const side of match.sides) {
    const won = isWinner(side, match.winnerSide);
    const lost = isLoser(side, match.winnerSide);
    for (const ep of side.entry.players) {
      if (ep.player) recordOutcomeTypeResult(entry.players, ep.player, won, lost);
    }
  }
}

/** A player's record for one outcome type, viewed from either the win or the loss angle. */
type LeaderCandidate = OutcomeTypeLeader & { rate: number };

function toCandidates(
  players: Map<string, OutcomeTypePlayerAcc>,
  metricOf: (p: OutcomeTypePlayerAcc) => number,
): LeaderCandidate[] {
  const total = Array.from(players.values()).reduce((sum, p) => sum + metricOf(p), 0);

  return Array.from(players.entries())
    .filter(([, p]) => metricOf(p) > 0)
    .map(([playerId, p]) => {
      const count = metricOf(p);
      const rate = p.played > 0 ? count / p.played : 0;
      return {
        playerId,
        displayName: p.displayName,
        shortName: p.shortName,
        count,
        matchesPlayed: p.played,
        ratePct: Math.round(rate * 100),
        sharePct: total > 0 ? Math.round((count / total) * 100) : 0,
        rate,
      };
    });
}

function stripRate(candidates: LeaderCandidate[]): OutcomeTypeLeader[] {
  return candidates.map(({ rate: _rate, ...leader }) => leader);
}

function rankByVolume(candidates: LeaderCandidate[]): OutcomeTypeLeader[] {
  const ranked = [...candidates]
    .sort((a, b) => b.count - a.count || b.ratePct - a.ratePct)
    .slice(0, TOP_WEIGHTED_RATE);
  return stripRate(ranked);
}

/**
 * Ranks by weighted rate, falling back to an unfiltered ranking when the match threshold
 * leaves nobody. Rare outcome types (fanny, win on foul…) would otherwise show an empty
 * column; the flag lets the UI label the result as a small sample instead of hiding it.
 */
function rankByRate(candidates: LeaderCandidate[]): {
  leaders: OutcomeTypeLeader[];
  isLowSample: boolean;
} {
  const filtered = rankByWeightedRate(candidates, (c) => c.rate, (c) => c.matchesPlayed);
  if (filtered.length > 0) return { leaders: stripRate(filtered), isLowSample: false };

  const fallback = rankByWeightedRate(candidates, (c) => c.rate, (c) => c.matchesPlayed, 0);
  return { leaders: stripRate(fallback), isLowSample: fallback.length > 0 };
}

export function computeOutcomeTypeFunStats(matchesData: MatchData[]): OutcomeTypeFunStat[] {
  const typeMap = new Map<string, OutcomeTypeAcc>();

  for (const match of matchesData) {
    if (!match.outcomeType || !match.outcomeTypeId) continue;

    const typeId = match.outcomeTypeId;
    if (!typeMap.has(typeId)) {
      typeMap.set(typeId, { name: match.outcomeType.name, totalMatches: 0, players: new Map() });
    }
    const entry = typeMap.get(typeId)!;
    entry.totalMatches++;
    countOutcomePlayers(match, entry);
  }

  return Array.from(typeMap.entries())
    .map(([outcomeTypeId, data]) => {
      const winners = toCandidates(data.players, (p) => p.wins);
      const losers = toCandidates(data.players, (p) => p.losses);
      const winnersByRate = rankByRate(winners);
      const losersByRate = rankByRate(losers);

      return {
        outcomeTypeId,
        outcomeTypeName: data.name,
        totalMatches: data.totalMatches,
        topWinnersByVolume: rankByVolume(winners),
        topWinnersByRate: winnersByRate.leaders,
        topLosersByVolume: rankByVolume(losers),
        topLosersByRate: losersByRate.leaders,
        winnersRateIsLowSample: winnersByRate.isLowSample,
        losersRateIsLowSample: losersByRate.isLowSample,
      };
    })
    .sort((a, b) => b.totalMatches - a.totalMatches || a.outcomeTypeName.localeCompare(b.outcomeTypeName));
}

function fillMomentumDays(
  raw: { date: string; matchCount: number }[],
  startDate: string,
  endDate: string,
): { date: string; matchCount: number }[] {
  const countByDay = new Map(raw.map((r) => [r.date, r.matchCount]));
  const result: { date: string; matchCount: number }[] = [];

  const today = new Date().toISOString().slice(0, 10);
  const lastDay = endDate <= today ? endDate : today;

  const cursor = new Date(startDate);
  const end = new Date(lastDay);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, matchCount: countByDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

class TournamentStatsService {
  async getStats(tournamentId: string): Promise<TournamentStats> {
    const cached = await tournamentStatsRepository.getComputedStats(tournamentId);
    if (cached) return cached;

    const result = await this.computeStats(tournamentId);
    await tournamentStatsRepository.setComputedStats(tournamentId, result);
    return result;
  }

  private async computeStats(tournamentId: string): Promise<TournamentStats> {
    const tournamentInfo = await tournamentStatsRepository.getTournamentMode(tournamentId);
    if (!tournamentInfo) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    const [distributionRaw, matchesData, momentumRaw] = await Promise.all([
      tournamentStatsRepository.getOutcomeDistribution(tournamentId),
      tournamentStatsRepository.getMatchesWithSidesAndPlayers(tournamentId),
      tournamentStatsRepository.getMomentum(tournamentId),
    ]);

    const momentum = fillMomentumDays(momentumRaw, tournamentInfo.startDate, tournamentInfo.endDate);

    const outcomeDistribution: OutcomeTypeCount[] = distributionRaw.map((row) => ({
      outcomeTypeId: row.outcomeTypeId,
      outcomeTypeName: row.outcomeTypeName ?? null,
      isDefault: row.isDefault ?? true,
      count: row.count,
    }));

    const totalFinalized = matchesData.length;
    const totalMatches = totalFinalized;

    const bestTeams: BestTeamEntry[] =
      tournamentInfo.teamMode === "flex" ? computeBestTeams(matchesData) : [];

    const winStreaks: WinStreakEntry[] = computeWinStreaks(matchesData);
    const lossStreaks: WinStreakEntry[] = computeLossStreaks(matchesData);
    const invincibleStreaks: WinStreakEntry[] = computeBestInvincibleStreak(matchesData);

    const bestDuoPlayers: BestDuoEntry[] =
      tournamentInfo.teamMode === "flex" ? computeBestDuoPlayers(matchesData) : [];

    const bestSoloPlayers: BestDuoEntry[] = computeBestSoloPlayers(matchesData);

    const bestAsymmetricSoloPlayers: BestDuoEntry[] =
      tournamentInfo.rankedConfig?.allowAsymmetricMatches
        ? computeBestAsymmetricSoloPlayers(matchesData)
        : [];

    const outcomeTypeFunStats: OutcomeTypeFunStat[] = computeOutcomeTypeFunStats(matchesData);

    return {
      totalMatches,
      totalFinalized,
      outcomeDistribution,
      bestTeams,
      momentum,
      winStreaks,
      lossStreaks,
      invincibleStreaks,
      bestDuoPlayers,
      bestSoloPlayers,
      bestAsymmetricSoloPlayers,
      outcomeTypeFunStats,
    };
  }
}

export const tournamentStatsService = new TournamentStatsService();
