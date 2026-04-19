import { tournamentStatsRepository } from "../repository/tournament-stats.repository";
import { NotFoundError, ErrorCode } from "../types/errors";
import type {
  TournamentStats,
  OutcomeTypeCount,
  BestTeamEntry,
  WinStreakEntry,
  BestDuoEntry,
  OutcomeTypeFunStat,
} from "@skill-arena/shared";

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
  const playerMatches = new Map<
    string,
    { displayName: string; shortName: string; results: { playedAt: Date; won: boolean }[] }
  >();

  for (const match of matchesData) {
    for (const side of match.sides) {
      for (const ep of side.entry.players) {
        if (!ep.player) continue;
        const { id, displayName, shortName } = ep.player;
        if (!playerMatches.has(id)) {
          playerMatches.set(id, { displayName, shortName, results: [] });
        }
        playerMatches.get(id)!.results.push({
          playedAt: new Date(match.playedAt),
          won: isWinner(side, match.winnerSide),
        });
      }
    }
  }

  const streaks: WinStreakEntry[] = [];

  for (const [playerId, data] of playerMatches) {
    const sorted = [...data.results].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
    let streak = 0;
    for (const r of sorted) {
      if (r.won) streak++;
      else break;
    }
    if (streak >= 2) {
      streaks.push({ playerId, displayName: data.displayName, shortName: data.shortName, currentStreak: streak });
    }
  }

  return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
}

function computeBestDuoPlayers(matchesData: MatchData[]): BestDuoEntry[] {
  const playerStats = new Map<
    string,
    { displayName: string; shortName: string; wins: number; losses: number; played: number }
  >();

  for (const match of matchesData) {
    const sideA = match.sides.find((s) => s.position === 1);
    const sideB = match.sides.find((s) => s.position === 2);
    if (!sideA || !sideB) continue;
    if (sideA.entry.players.length !== 2 || sideB.entry.players.length !== 2) continue;

    for (const side of [sideA, sideB]) {
      const won = isWinner(side, match.winnerSide);
      const lost = isLoser(side, match.winnerSide);
      for (const ep of side.entry.players) {
        if (!ep.player) continue;
        const { id, displayName, shortName } = ep.player;
        if (!playerStats.has(id)) {
          playerStats.set(id, { displayName, shortName, wins: 0, losses: 0, played: 0 });
        }
        const s = playerStats.get(id)!;
        s.played++;
        if (won) s.wins++;
        if (lost) s.losses++;
      }
    }
  }

  return Array.from(playerStats.entries())
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

function computeBestInvincibleStreak(matchesData: MatchData[]): WinStreakEntry[] {
  const playerMatches = new Map<
    string,
    { displayName: string; shortName: string; results: { playedAt: Date; notLost: boolean }[] }
  >();

  for (const match of matchesData) {
    for (const side of match.sides) {
      for (const ep of side.entry.players) {
        if (!ep.player) continue;
        const { id, displayName, shortName } = ep.player;
        if (!playerMatches.has(id)) playerMatches.set(id, { displayName, shortName, results: [] });
        playerMatches.get(id)!.results.push({
          playedAt: new Date(match.playedAt),
          notLost: !isLoser(side, match.winnerSide),
        });
      }
    }
  }

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

function computeOutcomeTypeFunStats(matchesData: MatchData[]): OutcomeTypeFunStat[] {
  const typeMap = new Map<
    string,
    {
      name: string;
      winners: Map<string, { displayName: string; shortName: string; count: number }>;
      losers: Map<string, { displayName: string; shortName: string; count: number }>;
    }
  >();

  for (const match of matchesData) {
    if (!match.outcomeType || !match.outcomeTypeId) continue;

    const typeId = match.outcomeTypeId;
    if (!typeMap.has(typeId)) {
      typeMap.set(typeId, { name: match.outcomeType.name, winners: new Map(), losers: new Map() });
    }
    const entry = typeMap.get(typeId)!;

    for (const side of match.sides) {
      for (const ep of side.entry.players) {
        if (!ep.player) continue;
        const { id, displayName, shortName } = ep.player;
        if (isWinner(side, match.winnerSide)) {
          const w = entry.winners.get(id) ?? { displayName, shortName, count: 0 };
          w.count++;
          entry.winners.set(id, w);
        } else if (isLoser(side, match.winnerSide)) {
          const l = entry.losers.get(id) ?? { displayName, shortName, count: 0 };
          l.count++;
          entry.losers.set(id, l);
        }
      }
    }
  }

  const result: OutcomeTypeFunStat[] = [];
  for (const [outcomeTypeId, data] of typeMap) {
    const topWinnerEntry = Array.from(data.winners.entries()).sort((a, b) => b[1].count - a[1].count)[0];
    const topLoserEntry = Array.from(data.losers.entries()).sort((a, b) => b[1].count - a[1].count)[0];

    result.push({
      outcomeTypeId,
      outcomeTypeName: data.name,
      topWinner: topWinnerEntry
        ? { playerId: topWinnerEntry[0], ...topWinnerEntry[1] }
        : null,
      topLoser: topLoserEntry
        ? { playerId: topLoserEntry[0], ...topLoserEntry[1] }
        : null,
    });
  }

  return result;
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
    const invincibleStreaks: WinStreakEntry[] = computeBestInvincibleStreak(matchesData);

    const bestDuoPlayers: BestDuoEntry[] =
      tournamentInfo.teamMode === "flex" ? computeBestDuoPlayers(matchesData) : [];

    const outcomeTypeFunStats: OutcomeTypeFunStat[] = computeOutcomeTypeFunStats(matchesData);

    return {
      totalMatches,
      totalFinalized,
      outcomeDistribution,
      bestTeams,
      momentum,
      winStreaks,
      invincibleStreaks,
      bestDuoPlayers,
      outcomeTypeFunStats,
    };
  }
}

export const tournamentStatsService = new TournamentStatsService();
