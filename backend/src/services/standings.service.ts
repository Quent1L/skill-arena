import { standingsRepository } from "../repository/standings.repository";
import { NotFoundError, ErrorCode } from "../types/errors";
import {
  type MatchStatus,
  type StandingsEntry,
  type StandingsResult,
} from "@skill-arena/shared/types/index";

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

    // 3. Initialize standings based on team mode
    const standingsMap = new Map<string, StandingsEntry>();

    if (tournament.teamMode === "static") {
      await this.initializeStaticTeamStandings(
        tournamentId,
        standingsMap
      );
    } else {
      await this.initializeFlexTeamStandings(
        tournamentId,
        standingsMap
      );
    }

    // 4. Get match participations for flex mode if needed
    const matchParticipations =
      tournament.teamMode === "flex"
        ? await standingsRepository.getMatchParticipations(
            matches.map((m) => m.id)
          )
        : [];

    // 5. Process each match
    for (const match of matches) {
      if (tournament.teamMode === "static") {
        this.processStaticTeamMatch(
          match,
          standingsMap,
          tournament
        );
      } else {
        this.processFlexTeamMatch(
          match,
          matchParticipations,
          standingsMap,
          tournament
        );
      }
    }

    // 6. Convert map to array and sort
    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings);

    return { standings };
  }

  /**
   * Initialize standings for static team mode
   */
  private async initializeStaticTeamStandings(
    tournamentId: string,
    standingsMap: Map<string, StandingsEntry>
  ) {
    const teams = await standingsRepository.getTournamentTeams(tournamentId);

    for (const team of teams) {
      standingsMap.set(team.id, {
        id: team.id,
        name: team.name,
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

  /**
   * Initialize standings for flex team mode
   */
  private async initializeFlexTeamStandings(
    tournamentId: string,
    standingsMap: Map<string, StandingsEntry>
  ) {
    const participants =
      await standingsRepository.getTournamentParticipants(tournamentId);

    for (const participant of participants) {
      standingsMap.set(participant.userId, {
        id: participant.userId,
        name: participant.user.displayName,
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

  /**
   * Process a match for static team mode
   */
  private processStaticTeamMatch(
    match: {
      id: string;
      teamAId: string | null;
      teamBId: string | null;
      scoreA: number;
      scoreB: number;
      winnerId: string | null;
      winnerSide: "A" | "B" | null;
    },
    standingsMap: Map<string, StandingsEntry>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    }
  ) {
    if (!match.teamAId || !match.teamBId) {
      return;
    }

    const teamA = standingsMap.get(match.teamAId);
    const teamB = standingsMap.get(match.teamBId);

    if (!teamA || !teamB) {
      return;
    }

    // Update scores
    teamA.scored += match.scoreA;
    teamA.conceded += match.scoreB;
    teamB.scored += match.scoreB;
    teamB.conceded += match.scoreA;

    // Update score difference
    teamA.scoreDiff = teamA.scored - teamA.conceded;
    teamB.scoreDiff = teamB.scored - teamB.conceded;

    // Determine result
    const isDraw = match.scoreA === match.scoreB && tournament.allowDraw;

    if (isDraw) {
      teamA.draws += 1;
      teamB.draws += 1;
      teamA.points += tournament.pointPerDraw ?? 1;
      teamB.points += tournament.pointPerDraw ?? 1;
    } else if (match.winnerId) {
      if (match.winnerId === match.teamAId) {
        teamA.wins += 1;
        teamB.losses += 1;
        teamA.points += tournament.pointPerVictory ?? 3;
        teamB.points += tournament.pointPerLoss ?? 0;
      } else {
        teamB.wins += 1;
        teamA.losses += 1;
        teamB.points += tournament.pointPerVictory ?? 3;
        teamA.points += tournament.pointPerLoss ?? 0;
      }
    }

    // Increment matches played
    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;
  }

  /**
   * Process a match for flex team mode
   */
  private processFlexTeamMatch(
    match: {
      id: string;
      teamAId: string | null;
      teamBId: string | null;
      scoreA: number;
      scoreB: number;
      winnerId: string | null;
      winnerSide: "A" | "B" | null;
    },
    matchParticipations: Array<{
      matchId: string;
      playerId: string;
      teamSide: "A" | "B";
      player: {
        id: string;
      };
    }>,
    standingsMap: Map<string, StandingsEntry>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    }
  ) {
    // Get players for each side
    const playersA = matchParticipations
      .filter((p) => p.matchId === match.id && p.teamSide === "A")
      .map((p) => p.playerId);

    const playersB = matchParticipations
      .filter((p) => p.matchId === match.id && p.teamSide === "B")
      .map((p) => p.playerId);

    // Determine result
    const isDraw = match.scoreA === match.scoreB && tournament.allowDraw;
    const teamAWins = match.winnerSide === "A";

    // Update stats for all players in team A
    for (const playerId of playersA) {
      const player = standingsMap.get(playerId);
      if (!player) continue;

      player.scored += match.scoreA;
      player.conceded += match.scoreB;
      player.scoreDiff = player.scored - player.conceded;

      if (isDraw) {
        player.draws += 1;
        player.points += tournament.pointPerDraw ?? 1;
      } else if (teamAWins) {
        player.wins += 1;
        player.points += tournament.pointPerVictory ?? 3;
      } else {
        player.losses += 1;
        player.points += tournament.pointPerLoss ?? 0;
      }

      player.matchesPlayed += 1;
    }

    // Update stats for all players in team B
    for (const playerId of playersB) {
      const player = standingsMap.get(playerId);
      if (!player) continue;

      player.scored += match.scoreB;
      player.conceded += match.scoreA;
      player.scoreDiff = player.scored - player.conceded;

      if (isDraw) {
        player.draws += 1;
        player.points += tournament.pointPerDraw ?? 1;
      } else if (teamAWins) {
        player.losses += 1;
        player.points += tournament.pointPerLoss ?? 0;
      } else {
        player.wins += 1;
        player.points += tournament.pointPerVictory ?? 3;
      }

      player.matchesPlayed += 1;
    }
  }

  /**
   * Sort standings according to tie-breakers:
   * 1. points (desc)
   * 2. scoreDiff (desc)
   * 3. scored (desc)
   * 4. id (asc, for stable sort)
   */
  private sortStandings(standings: StandingsEntry[]) {
    standings.sort((a, b) => {
      // 1. Points
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      // 2. Score difference
      if (b.scoreDiff !== a.scoreDiff) {
        return b.scoreDiff - a.scoreDiff;
      }

      // 3. Scored
      if (b.scored !== a.scored) {
        return b.scored - a.scored;
      }

      // 4. Stable sort by id
      return a.id.localeCompare(b.id);
    });
  }
}

export const standingsService = new StandingsService();

