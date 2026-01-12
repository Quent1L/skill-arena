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

    // 4. Process each match
    for (const match of matches) {
      // Skip if not enough participants (need 2 for score calculation usually)
      if (!match.participants || match.participants.length < 2) continue;

      if (tournament.teamMode === "static") {
        this.processStaticTeamMatch(
          match,
          standingsMap,
          tournament
        );
      } else {
        this.processFlexTeamMatch(
          match,
          standingsMap,
          tournament
        );
      }
    }

    // 5. Convert map to array and sort
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
    match: any, // Typed as result of getMatchesForStandings
    standingsMap: Map<string, StandingsEntry>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    }
  ) {
    const p1 = match.participants[0];
    const p2 = match.participants[1];

    if (!p1.teamId || !p2.teamId) return;

    const team1 = standingsMap.get(p1.teamId);
    const team2 = standingsMap.get(p2.teamId);

    if (!team1 || !team2) return;

    const score1 = p1.score ?? 0;
    const score2 = p2.score ?? 0;

    // Update scores
    team1.scored += score1;
    team1.conceded += score2;
    team2.scored += score2;
    team2.conceded += score1;

    // Update score difference
    team1.scoreDiff = team1.scored - team1.conceded;
    team2.scoreDiff = team2.scored - team2.conceded;

    // Determine result
    const isDraw = score1 === score2 && tournament.allowDraw;

    if (isDraw) {
      team1.draws += 1;
      team2.draws += 1;
      team1.points += tournament.pointPerDraw ?? 1;
      team2.points += tournament.pointPerDraw ?? 1;
    } else if (p1.isWinner) {
      team1.wins += 1;
      team2.losses += 1;
      team1.points += tournament.pointPerVictory ?? 3;
      team2.points += tournament.pointPerLoss ?? 0;
    } else if (p2.isWinner) {
      team2.wins += 1;
      team1.losses += 1;
      team2.points += tournament.pointPerVictory ?? 3;
      team1.points += tournament.pointPerLoss ?? 0;
    } else {
      // Fallback based on score if isWinner not set properly or draw not allowed but scores equal?
      if (score1 > score2) {
        team1.wins += 1; team2.losses += 1;
        team1.points += tournament.pointPerVictory ?? 3;
        team2.points += tournament.pointPerLoss ?? 0;
      } else if (score2 > score1) {
        team2.wins += 1; team1.losses += 1;
        team2.points += tournament.pointPerVictory ?? 3;
        team1.points += tournament.pointPerLoss ?? 0;
      }
    }

    // Increment matches played
    team1.matchesPlayed += 1;
    team2.matchesPlayed += 1;
  }

  /**
   * Process a match for flex team mode
   */
  private processFlexTeamMatch(
    match: any,
    standingsMap: Map<string, StandingsEntry>,
    tournament: {
      pointPerVictory: number | null;
      pointPerDraw: number | null;
      pointPerLoss: number | null;
      allowDraw: boolean | null;
    }
  ) {
    const p1 = match.participants[0];
    const p2 = match.participants[1];

    // Get players for each side from match_participant_players relation
    const players1 = p1.players?.map((pp: any) => pp.playerId) ?? [];
    const players2 = p2.players?.map((pp: any) => pp.playerId) ?? [];

    const score1 = p1.score ?? 0;
    const score2 = p2.score ?? 0;

    const isDraw = score1 === score2 && tournament.allowDraw;
    const p1Wins = p1.isWinner || (score1 > score2 && !isDraw); // Helper logic
    const p2Wins = p2.isWinner || (score2 > score1 && !isDraw);

    // Update stats for all players in team 1
    for (const playerId of players1) {
      const player = standingsMap.get(playerId);
      if (!player) continue;

      player.scored += score1;
      player.conceded += score2;
      player.scoreDiff = player.scored - player.conceded;

      if (isDraw) {
        player.draws += 1;
        player.points += tournament.pointPerDraw ?? 1;
      } else if (p1Wins) {
        player.wins += 1;
        player.points += tournament.pointPerVictory ?? 3;
      } else {
        player.losses += 1;
        player.points += tournament.pointPerLoss ?? 0;
      }
      player.matchesPlayed += 1;
    }

    // Update stats for all players in team 2
    for (const playerId of players2) {
      const player = standingsMap.get(playerId);
      if (!player) continue;

      player.scored += score2;
      player.conceded += score1;
      player.scoreDiff = player.scored - player.conceded;

      if (isDraw) {
        player.draws += 1;
        player.points += tournament.pointPerDraw ?? 1;
      } else if (p1Wins) { // p1 won means p2 lost
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
