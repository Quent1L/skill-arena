import { playerStatsRepository } from "../repository/player-stats.repository";
import { NotFoundError, ErrorCode } from "../types/errors";
import type {
  PlayerProfile,
  PlayerDetailStats,
  PlayerRelationStat,
  PlayerStatsResponse,
  PlayerStatsFilters,
  PlayerTournamentOption,
  PlayerTournamentEntry,
} from "@skill-arena/shared";

type MatchResult = {
  matchId: string;
  entryId: string;
  ownScore: number;
  ownPosition: number;
  winnerSide: string | null;
  oppEntryId: string;
  oppScore: number;
};

export class PlayerStatsService {
  async getPlayerProfile(playerId: string): Promise<PlayerProfile> {
    const user = await playerStatsRepository.getPlayerProfile(playerId);
    if (!user) throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    return { id: user.id, displayName: user.displayName, shortName: user.shortName };
  }

  async getPlayerTournaments(playerId: string): Promise<PlayerTournamentOption[]> {
    const rows = await playerStatsRepository.getPlayerTournaments(playerId);
    const seen = new Set<string>();
    return rows
      .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .map((r) => ({
        id: r.id,
        name: r.name,
        mode: r.mode,
        disciplineId: r.disciplineId ?? undefined,
        disciplineName: r.disciplineName ?? undefined,
      }));
  }

  async getPlayerStats(playerId: string, filters: PlayerStatsFilters): Promise<PlayerStatsResponse> {
    const player = await this.getPlayerProfile(playerId);
    const entries = await playerStatsRepository.getPlayerEntries(playerId, filters);

    if (entries.length === 0) {
      return this.buildEmptyResponse(player, filters);
    }

    const playerEntryIds = entries.map((e) => e.entryId);
    const matchResults = await playerStatsRepository.getPlayerMatchResults(playerEntryIds);

    if (matchResults.length === 0) {
      return this.buildEmptyResponse(player, filters);
    }

    const baseStats = this.aggregateBaseStats(matchResults);
    const partnerStats = await this.computePartnerStats(matchResults, playerEntryIds, playerId);
    const nemesisStats = await this.computeNemesisStats(matchResults, playerEntryIds, playerId);
    const tournamentHistory = await this.buildTournamentHistory(playerId, entries);

    const stats: PlayerDetailStats = {
      ...baseStats,
      tournamentsParticipated: new Set(entries.map((e) => e.tournamentId)).size,
      mostFrequentPartners: partnerStats.frequent,
      bestPartners: partnerStats.best,
      nemeses: nemesisStats,
      tournamentHistory,
    };

    return { player, stats, filters };
  }

  private aggregateBaseStats(matchResults: MatchResult[]) {
    const seen = new Set<string>();
    let wins = 0, draws = 0, losses = 0, totalScore = 0;

    for (const r of matchResults) {
      if (seen.has(r.matchId)) continue;
      seen.add(r.matchId);
      totalScore += r.ownScore;
      const isWin = (r.ownPosition === 1 && r.winnerSide === "A") || (r.ownPosition === 2 && r.winnerSide === "B");
      const isLoss = (r.ownPosition === 1 && r.winnerSide === "B") || (r.ownPosition === 2 && r.winnerSide === "A");
      if (isWin) wins++;
      else if (isLoss) losses++;
      else draws++;
    }

    const totalMatches = seen.size;
    return {
      totalMatches,
      wins,
      draws,
      losses,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
      averageScore: totalMatches > 0 ? Math.round((totalScore / totalMatches) * 10) / 10 : 0,
    };
  }

  private async computePartnerStats(
    matchResults: MatchResult[],
    playerEntryIds: string[],
    playerId: string
  ): Promise<{ frequent: PlayerRelationStat[]; best: PlayerRelationStat[] }> {
    const partnerEntryIds = [...new Set(playerEntryIds)];
    const playersInEntries = await playerStatsRepository.getPlayersInEntries(partnerEntryIds);

    const entryToPlayers = new Map<string, Array<{ playerId: string; displayName: string; shortName: string }>>();
    for (const p of playersInEntries) {
      if (!entryToPlayers.has(p.entryId)) entryToPlayers.set(p.entryId, []);
      entryToPlayers.get(p.entryId)!.push({ playerId: p.playerId, displayName: p.displayName, shortName: p.shortName });
    }

    const partnerStats = new Map<string, { displayName: string; shortName: string; count: number; wins: number; losses: number }>();
    const seenMatches = new Set<string>();

    for (const r of matchResults) {
      if (seenMatches.has(r.matchId)) continue;
      seenMatches.add(r.matchId);
      const partners = entryToPlayers.get(r.entryId) ?? [];
      const isWin = (r.ownPosition === 1 && r.winnerSide === "A") || (r.ownPosition === 2 && r.winnerSide === "B");
      const isLoss = (r.ownPosition === 1 && r.winnerSide === "B") || (r.ownPosition === 2 && r.winnerSide === "A");

      for (const partner of partners) {
        if (partner.playerId === playerId) continue;
        if (!partnerStats.has(partner.playerId)) {
          partnerStats.set(partner.playerId, { displayName: partner.displayName, shortName: partner.shortName, count: 0, wins: 0, losses: 0 });
        }
        const stat = partnerStats.get(partner.playerId)!;
        stat.count++;
        if (isWin) stat.wins++;
        if (isLoss) stat.losses++;
      }
    }

    const toRelationStat = (id: string, s: typeof partnerStats extends Map<string, infer V> ? V : never): PlayerRelationStat =>
      ({ playerId: id, displayName: s.displayName, shortName: s.shortName, count: s.count, wins: s.wins, losses: s.losses });

    const allPartners = Array.from(partnerStats.entries()).map(([id, s]) => toRelationStat(id, s));
    const frequent = [...allPartners].sort((a, b) => b.count - a.count).slice(0, 3);
    const best = [...allPartners]
      .filter((p) => p.count > 0)
      .sort((a, b) => (b.wins / b.count) - (a.wins / a.count))
      .slice(0, 3);

    return { frequent, best };
  }

  private async computeNemesisStats(
    matchResults: MatchResult[],
    playerEntryIds: string[],
    playerId: string
  ): Promise<PlayerRelationStat[]> {
    const oppEntryIds = [...new Set(matchResults.map((r) => r.oppEntryId))];
    const playersInOppEntries = await playerStatsRepository.getPlayersInEntries(oppEntryIds);

    const entryToPlayers = new Map<string, Array<{ playerId: string; displayName: string; shortName: string }>>();
    for (const p of playersInOppEntries) {
      if (!entryToPlayers.has(p.entryId)) entryToPlayers.set(p.entryId, []);
      entryToPlayers.get(p.entryId)!.push({ playerId: p.playerId, displayName: p.displayName, shortName: p.shortName });
    }

    const nemesisStats = new Map<string, { displayName: string; shortName: string; count: number; wins: number; losses: number }>();
    const seenMatches = new Set<string>();

    for (const r of matchResults) {
      if (seenMatches.has(r.matchId)) continue;
      seenMatches.add(r.matchId);
      const opponents = entryToPlayers.get(r.oppEntryId) ?? [];
      const isWin = (r.ownPosition === 1 && r.winnerSide === "A") || (r.ownPosition === 2 && r.winnerSide === "B");
      const isLoss = (r.ownPosition === 1 && r.winnerSide === "B") || (r.ownPosition === 2 && r.winnerSide === "A");

      for (const opp of opponents) {
        if (!nemesisStats.has(opp.playerId)) {
          nemesisStats.set(opp.playerId, { displayName: opp.displayName, shortName: opp.shortName, count: 0, wins: 0, losses: 0 });
        }
        const stat = nemesisStats.get(opp.playerId)!;
        stat.count++;
        if (isWin) stat.wins++;
        if (isLoss) stat.losses++;
      }
    }

    return Array.from(nemesisStats.entries())
      .map(([id, s]) => ({ playerId: id, displayName: s.displayName, shortName: s.shortName, count: s.count, wins: s.wins, losses: s.losses }))
      .sort((a, b) => b.losses - a.losses)
      .slice(0, 3);
  }

  private async buildTournamentHistory(
    playerId: string,
    entries: Array<{ tournamentId: string; tournamentName: string; tournamentMode: string; disciplineName: string | null }>
  ): Promise<PlayerTournamentEntry[]> {
    const seen = new Map<string, PlayerTournamentEntry>();

    for (const entry of entries) {
      if (seen.has(entry.tournamentId)) continue;
      const base: PlayerTournamentEntry = {
        tournamentId: entry.tournamentId,
        tournamentName: entry.tournamentName,
        mode: entry.tournamentMode,
        disciplineName: entry.disciplineName ?? undefined,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };

      if (entry.tournamentMode === "championship") {
        const standing = await playerStatsRepository.getPlayerStandingsForTournament(playerId, entry.tournamentId);
        if (standing) {
          base.matchesPlayed = standing.matchesPlayed;
          base.wins = standing.wins;
          base.draws = standing.draws;
          base.losses = standing.losses;
          base.points = standing.points;
        }
      }

      seen.set(entry.tournamentId, base);
    }

    return Array.from(seen.values());
  }

  private buildEmptyResponse(player: PlayerProfile, filters: PlayerStatsFilters): PlayerStatsResponse {
    return {
      player,
      filters,
      stats: {
        totalMatches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        winRate: 0,
        averageScore: 0,
        tournamentsParticipated: 0,
        mostFrequentPartners: [],
        bestPartners: [],
        nemeses: [],
        tournamentHistory: [],
      },
    };
  }
}

export const playerStatsService = new PlayerStatsService();
