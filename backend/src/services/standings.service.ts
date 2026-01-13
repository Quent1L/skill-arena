import { standingsRepository } from "../repository/standings.repository";
import { NotFoundError, ErrorCode } from "../types/errors";
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

    // 5. Process each match
    const matchSidesMap = new Map<string, typeof matchSides>();
    for (const side of matchSides) {
      if (!matchSidesMap.has(side.matchId)) {
        matchSidesMap.set(side.matchId, []);
      }
      matchSidesMap.get(side.matchId)!.push(side);
    }

    for (const match of matches) {
      const sides = matchSidesMap.get(match.id) || [];
      if (sides.length !== 2) continue; // Skip incomplete matches

      this.processMatch(sides, standingsMap, tournament, tournament.teamMode);
    }

    // 6. Convert map to array and sort
    const standings = Array.from(standingsMap.values());
    this.sortStandings(standings);

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
      const playersMap = new Map<string, { id: string; name: string }>();

      for (const entry of entries) {
        for (const ep of entry.players) {
          if (!playersMap.has(ep.playerId)) {
            playersMap.set(ep.playerId, {
              id: ep.playerId,
              name: ep.player.displayName,
            });
          }
        }
      }

      // Create standings entry for each unique player
      for (const player of playersMap.values()) {
        standingsMap.set(player.id, {
          id: player.id,
          name: player.name,
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
    teamMode: "static" | "flex"
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

      this.updateStandingsForSide(entryA, sideA, sideB, tournament);
      this.updateStandingsForSide(entryB, sideB, sideA, tournament);
    } else {
      // Flex mode: update each player individually
      const playersA = sideA.entry?.players || [];
      const playersB = sideB.entry?.players || [];

      // Update stats for each player on side A
      for (const player of playersA) {
        const playerStanding = standingsMap.get(player.playerId);
        if (!playerStanding) continue;

        // Find a representative player from side B to calculate stats
        const opponentStanding = standingsMap.get(playersB[0]?.playerId);
        if (!opponentStanding) continue;

        this.updateStandingsForPlayer(
          playerStanding,
          sideA.score,
          sideB.score,
          sideA.pointsAwarded,
          tournament
        );
      }

      // Update stats for each player on side B
      for (const player of playersB) {
        const playerStanding = standingsMap.get(player.playerId);
        if (!playerStanding) continue;

        this.updateStandingsForPlayer(
          playerStanding,
          sideB.score,
          sideA.score,
          sideB.pointsAwarded,
          tournament
        );
      }
    }
  }

  /**
   * Update standings for a side (static mode)
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
    }
  ) {
    // Update scores
    entry.scored += side.score;
    entry.conceded += opponentSide.score;
    entry.scoreDiff = entry.scored - entry.conceded;

    // Determine result
    const isDraw = side.score === opponentSide.score && tournament.allowDraw;
    const wins = side.score > opponentSide.score;

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
   * Update standings for a player (flex mode)
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
    }
  ) {
    // Update scores
    playerStanding.scored += ownScore;
    playerStanding.conceded += opponentScore;
    playerStanding.scoreDiff = playerStanding.scored - playerStanding.conceded;

    // Determine result
    const isDraw = ownScore === opponentScore && tournament.allowDraw;
    const wins = ownScore > opponentScore;

    if (isDraw) {
      playerStanding.draws += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerDraw ?? 1;
    } else if (wins) {
      playerStanding.wins += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerVictory ?? 3;
    } else {
      playerStanding.losses += 1;
      playerStanding.points += pointsAwarded ?? tournament.pointPerLoss ?? 0;
    }

    playerStanding.matchesPlayed += 1;
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
