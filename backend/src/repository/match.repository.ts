import { eq, and, sql, count } from "drizzle-orm";
import { db } from "../config/database";
import {
  matches,
  matchParticipation,
  tournamentParticipants,
  teams,
  tournaments,
  appUsers,
} from "../db/schema";
import { type MatchStatus } from "@skill-arena/shared/types/index";

// Type for synthetic team object used in flex team mode
type AppUser = typeof appUsers.$inferSelect;

interface SyntheticTeamParticipant {
  user: AppUser;
}

interface SyntheticTeam {
  participants: SyntheticTeamParticipant[];
}

export interface CreateMatchData {
  tournamentId: string;
  round?: number;
  teamAId?: string;
  teamBId?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  status?: MatchStatus;
  reportedBy?: string;
  reportedAt?: Date;
  confirmationBy?: string;
  confirmationAt?: Date;
  reportProof?: string;
}

export interface UpdateMatchData {
  round?: number;
  teamAId?: string;
  teamBId?: string;
  scoreA?: number;
  scoreB?: number;
  winnerId?: string;
  status?: MatchStatus;
  reportedBy?: string;
  reportedAt?: Date;
  confirmationBy?: string;
  confirmationAt?: Date;
  reportProof?: string;
}

export interface MatchFilters {
  tournamentId?: string;
  status?: MatchStatus;
  round?: number;
}

export interface CreateMatchParticipationData {
  matchId: string;
  playerId: string;
  teamSide: "A" | "B";
}

export class MatchRepository {
  /**
   * Create a new match
   */
  async create(data: CreateMatchData) {
    const [match] = await db.insert(matches).values(data).returning();
    return match;
  }

  /**
   * Get match by ID with relations
   */
  async getById(id: string) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, id),
      with: {
        tournament: true,
        teamA: {
          with: {
            participants: {
              with: {
                user: true,
              },
            },
          },
        },
        teamB: {
          with: {
            participants: {
              with: {
                user: true,
              },
            },
          },
        },
        winner: true,
        reporter: true,
        confirmer: true,
        participations: {
          with: {
            player: true,
          },
        },
      },
    });

    if (!match) return match;

    // If tournament uses flex teams, matches may not have teamA/teamB rows.
    // Populate synthetic team objects from participations so frontend gets participant info.
    if (
      (!match.teamA || !match.teamB) &&
      match.participations &&
      match.participations.length > 0
    ) {
      const playersA: SyntheticTeamParticipant[] = match.participations
        .filter((p) => p.teamSide === "A")
        .map((p) => ({ user: p.player }));

      const playersB: SyntheticTeamParticipant[] = match.participations
        .filter((p) => p.teamSide === "B")
        .map((p) => ({ user: p.player }));

      const syntheticTeamA: SyntheticTeam = { participants: playersA };
      const syntheticTeamB: SyntheticTeam = { participants: playersB };

      // Use unknown as intermediate type for type-safe casting
      if (!match.teamA) {
        match.teamA = syntheticTeamA as unknown as typeof match.teamA;
      }
      if (!match.teamB) {
        match.teamB = syntheticTeamB as unknown as typeof match.teamB;
      }
    }

    return match;
  }

  /**
   * Get match by ID (simple, without relations)
   */
  async getByIdSimple(id: string) {
    return await db.query.matches.findFirst({
      where: eq(matches.id, id),
    });
  }

  /**
   * List matches with optional filters
   */
  async list(filters?: MatchFilters) {
    const conditions = [];

    if (filters?.tournamentId) {
      conditions.push(eq(matches.tournamentId, filters.tournamentId));
    }
    if (filters?.status) {
      conditions.push(eq(matches.status, filters.status));
    }
    if (filters?.round) {
      conditions.push(eq(matches.round, filters.round));
    }

    const result = await db.query.matches.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tournament: true,
        teamA: {
          with: {
            participants: {
              with: {
                user: true,
              },
            },
          },
        },
        teamB: {
          with: {
            participants: {
              with: {
                user: true,
              },
            },
          },
        },
        // Include participations for flex team mode so frontend can show players
        participations: {
          with: {
            player: true,
          },
        },
        winner: true,
        reporter: true,
        confirmer: true,
      },
      orderBy: (matches, { desc }) => [desc(matches.id)],
    });

    // Post-process results: for flex tournaments where teamA/teamB are null,
    // synthesize team objects from participations so frontend can render players.
    const processed = result.map((m) => {
      if (
        (!m.teamA || !m.teamB) &&
        m.participations &&
        m.participations.length > 0
      ) {
        const playersA: SyntheticTeamParticipant[] = m.participations
          .filter((p) => p.teamSide === "A")
          .map((p) => ({ user: p.player }));

        const playersB: SyntheticTeamParticipant[] = m.participations
          .filter((p) => p.teamSide === "B")
          .map((p) => ({ user: p.player }));

        const syntheticTeamA: SyntheticTeam = { participants: playersA };
        const syntheticTeamB: SyntheticTeam = { participants: playersB };

        if (!m.teamA) {
          m.teamA = syntheticTeamA as unknown as typeof m.teamA;
        }
        if (!m.teamB) {
          m.teamB = syntheticTeamB as unknown as typeof m.teamB;
        }
      }

      // Ensure createdAt exists (some DB setups may not have it yet)
      if (!m.createdAt) {
        m.createdAt = new Date();
      }

      return m;
    });

    return processed;
  }

  /**
   * Update match
   */
  async update(id: string, data: UpdateMatchData) {
    const [updated] = await db
      .update(matches)
      .set(data)
      .where(eq(matches.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete match
   */
  async delete(id: string) {
    await db.delete(matches).where(eq(matches.id, id));
  }

  /**
   * Count matches for a tournament
   */
  async countByTournament(tournamentId: string) {
    const result = await db
      .select({ count: count() })
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId));

    return result[0]?.count ?? 0;
  }

  /**
   * Count matches for a user in a tournament
   */
  async countMatchesForUser(tournamentId: string, userId: string) {
    // For static teams: count matches where user is in teamA or teamB
    const staticMatches = await db
      .select({ count: count() })
      .from(matches)
      .innerJoin(
        teams,
        sql`${matches.teamAId} = ${teams.id} OR ${matches.teamBId} = ${teams.id}`
      )
      .innerJoin(
        tournamentParticipants,
        eq(teams.id, tournamentParticipants.teamId)
      )
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, userId)
        )
      );

    // For flex teams: count matches where user is in match_participation
    const flexMatches = await db
      .select({ count: count() })
      .from(matches)
      .innerJoin(matchParticipation, eq(matches.id, matchParticipation.matchId))
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(matchParticipation.playerId, userId)
        )
      );

    return (staticMatches[0]?.count ?? 0) + (flexMatches[0]?.count ?? 0);
  }

  /**
   * Count matches between same players (partners)
   */
  async countMatchesWithSamePartner(
    tournamentId: string,
    userId: string,
    partnerId: string
  ) {
    // Simplified implementation - count matches where both users participated
    const userMatches = await db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(matchParticipation, eq(matches.id, matchParticipation.matchId))
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(matchParticipation.playerId, userId)
        )
      );

    let count = 0;
    for (const match of userMatches) {
      const partnerInMatch = await db
        .select()
        .from(matchParticipation)
        .where(
          and(
            eq(matchParticipation.matchId, match.id),
            eq(matchParticipation.playerId, partnerId)
          )
        );
      if (partnerInMatch.length > 0) {
        count++;
      }
    }

    return count;
  }

  /**
   * Count matches against same opponent
   */
  async countMatchesWithSameOpponent(
    tournamentId: string,
    userId: string,
    opponentId: string
  ) {
    // Simplified implementation
    const userMatches = await db
      .select({ id: matches.id, teamSide: matchParticipation.teamSide })
      .from(matches)
      .innerJoin(matchParticipation, eq(matches.id, matchParticipation.matchId))
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(matchParticipation.playerId, userId)
        )
      );

    let count = 0;
    for (const userMatch of userMatches) {
      const opponentInMatch = await db
        .select()
        .from(matchParticipation)
        .where(
          and(
            eq(matchParticipation.matchId, userMatch.id),
            eq(matchParticipation.playerId, opponentId),
            sql`${matchParticipation.teamSide} != ${userMatch.teamSide}`
          )
        );
      if (opponentInMatch.length > 0) {
        count++;
      }
    }

    return count;
  }

  /**
   * Create match participation (for flex teams)
   */
  async createMatchParticipation(data: CreateMatchParticipationData) {
    const [participation] = await db
      .insert(matchParticipation)
      .values(data)
      .returning();
    return participation;
  }

  /**
   * Delete match participation
   */
  async deleteMatchParticipation(matchId: string) {
    await db
      .delete(matchParticipation)
      .where(eq(matchParticipation.matchId, matchId));
  }

  /**
   * Check if user is participant in match
   */
  async isUserInMatch(matchId: string, userId: string): Promise<boolean> {
    // Check static teams
    const staticParticipation = await db
      .select()
      .from(matches)
      .innerJoin(
        teams,
        sql`${matches.teamAId} = ${teams.id} OR ${matches.teamBId} = ${teams.id}`
      )
      .innerJoin(
        tournamentParticipants,
        eq(teams.id, tournamentParticipants.teamId)
      )
      .where(
        and(eq(matches.id, matchId), eq(tournamentParticipants.userId, userId))
      )
      .limit(1);

    if (staticParticipation.length > 0) {
      return true;
    }

    // Check flex teams
    const flexParticipation = await db.query.matchParticipation.findFirst({
      where: and(
        eq(matchParticipation.matchId, matchId),
        eq(matchParticipation.playerId, userId)
      ),
    });

    return !!flexParticipation;
  }

  /**
   * Get tournament by ID (for validation)
   */
  async getTournament(tournamentId: string) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
  }

  /**
   * Check if teams exist and belong to tournament
   */
  async validateTeamsForTournament(
    tournamentId: string,
    teamAId?: string,
    teamBId?: string
  ) {
    if (teamAId) {
      const teamA = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamAId), eq(teams.tournamentId, tournamentId)),
      });
      if (!teamA) {
        throw new Error("Équipe A n'existe pas ou n'appartient pas au tournoi");
      }
    }

    if (teamBId) {
      const teamB = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamBId), eq(teams.tournamentId, tournamentId)),
      });
      if (!teamB) {
        throw new Error("Équipe B n'existe pas ou n'appartient pas au tournoi");
      }
    }

    if (teamAId && teamBId && teamAId === teamBId) {
      throw new Error("Les deux équipes ne peuvent pas être identiques");
    }
  }

  /**
   * Check if players are participants in tournament
   */
  async validatePlayersForTournament(
    tournamentId: string,
    playerIds: string[]
  ) {
    for (const playerId of playerIds) {
      const participant = await db.query.tournamentParticipants.findFirst({
        where: and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.userId, playerId)
        ),
      });
      if (!participant) {
        throw new Error(`Joueur ${playerId} n'est pas inscrit au tournoi`);
      }
    }
  }
}

export const matchRepository = new MatchRepository();
