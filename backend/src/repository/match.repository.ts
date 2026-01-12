import { eq, and, ne, sql, count, inArray } from "drizzle-orm";
import { db } from "../config/database";
import {
  matches,
  matchSides,
  tournamentEntries,
  tournamentEntryPlayers,
  tournaments,
  appUsers,
  teams,
} from "../db/schema";
import { type MatchStatus } from "@skill-arena/shared/types/index";

// TODO: Update types in shared package or define here temporarily
// export interface CreateMatchData { ... } matching new schema

export interface CreateMatchData {
  tournamentId: string;
  round?: number;
  // stage/group/round FKs
  stageId: string;
  groupId?: string;
  roundId?: string;
  matchNumber: number;

  status?: MatchStatus;
  scheduledAt?: Date;

  reportedBy?: string;
  reportedAt?: Date;
  reportProof?: string;
  confirmationDeadline?: Date;
  outcomeTypeId?: string;
  outcomeReasonId?: string;

  // Brackets fields
  bracketType?: "winner" | "loser" | "grand_final";
  sequence?: number; // Check if still needed in new schema
  nextMatchWinId?: string;
  nextMatchLoseId?: string;
  matchPosition?: number;
  childCount?: number;
  bracketStatus?: number;
  opponent1?: unknown;
  opponent2?: unknown;

  // Sides to create immediately
  sides?: {
    entryId: string;
    position: number;
    score?: number;
    pointsAwarded?: number;
  }[];
}

export interface UpdateMatchData {
  status?: MatchStatus;
  reportedBy?: string;
  reportedAt?: Date;
  reportProof?: string;
  confirmationDeadline?: Date;
  finalizedAt?: Date;
  finalizedBy?: string;
  // finalizationReason?: MatchFinalizationReason; // Removed from schema? Or kept? Checked schema: removed from enum? No, kept as enum but check column. matches table in schema update has `finalizationReason`? I don't see it in matches table definition in previous turn.
  // Actually I removed `matchFinalizationReasonEnum` usage in matches table in my replace.
  // It was in the diff:
  // -  finalizationReason: matchFinalizationReasonEnum("finalization_reason"),
  // So likely removed.

  scheduledAt?: Date;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
  nextMatchWinId?: string;
  nextMatchLoseId?: string;
  opponent1?: unknown; // JSONB
  opponent2?: unknown; // JSONB

  // TODO: Add support for updating sides via this method or separate repository call
}

export interface MatchFilters {
  tournamentId?: string;
  status?: MatchStatus;
  stageId?: string;
  groupId?: string;
  roundId?: string;
}

export class MatchRepository {
  /**
   * Create a new match
   */
  async create(data: CreateMatchData) {
    const { sides, ...matchData } = data;

    // 1. Create the match
    const [match] = await db.insert(matches).values(matchData).returning();

    // 2. Create sides if provided
    if (sides && sides.length > 0) {
      await db.insert(matchSides).values(
        sides.map(s => ({
          matchId: match.id,
          ...s
        }))
      );
    }

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
        stage: true,
        group: true,
        round: true,
        sides: {
          with: {
            entry: {
              with: {
                team: true,
                players: {
                  with: {
                    player: true
                  }
                }
              }
            }
          },
          orderBy: (matchSides, { asc }) => [asc(matchSides.position)],
        },
        reporter: true,
        finalizer: true,
        outcomeType: {
          with: {
            discipline: true,
          },
        },
        outcomeReason: {
          with: {
            outcomeType: true
          }
        },
        confirmations: {
          with: {
            player: true,
          },
        },
      },
    });

    if (!match) return null;

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
    if (filters?.stageId) {
      conditions.push(eq(matches.stageId, filters.stageId));
    }
    if (filters?.groupId) {
      conditions.push(eq(matches.groupId, filters.groupId));
    }
    if (filters?.roundId) {
      conditions.push(eq(matches.roundId, filters.roundId));
    }

    const result = await db.query.matches.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tournament: true,
        sides: {
          with: {
            entry: {
              with: {
                team: true,
                players: {
                  with: {
                    player: true
                  }
                }
              }
            }
          },
          orderBy: (matchSides, { asc }) => [asc(matchSides.position)],
        },
        reporter: true,
        outcomeType: true,
      },
      orderBy: (matches, { desc }) => [desc(matches.id)],
    });

    return result;
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
  async countMatchesForUser(tournamentId: string, userId: string, excludeMatchId?: string) {
    const matchConditions = [eq(matches.tournamentId, tournamentId)];
    if (excludeMatchId) {
      matchConditions.push(ne(matches.id, excludeMatchId));
    }

    // Match -> MatchSide -> TournamentEntry -> TournamentEntryPlayers -> User
    const result = await db
      .select({ count: count() })
      .from(matches)
      .innerJoin(matchSides, eq(matches.id, matchSides.matchId))
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(
        and(
          ...matchConditions,
          eq(tournamentEntryPlayers.playerId, userId)
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count matches between same players (partners)
   */
  async countMatchesWithSamePartner(
    tournamentId: string,
    userId: string,
    partnerId: string,
    excludeMatchId?: string
  ) {
    // Two users are partners if they are in the SAME TournamentEntry that is in a Match
    const matchConditions = [eq(matches.tournamentId, tournamentId)];
    if (excludeMatchId) {
      matchConditions.push(ne(matches.id, excludeMatchId));
    }

    // This is checking if they played TOGETHER (same side)
    const result = await db.execute(sql`
        SELECT COUNT(DISTINCT m.id) as count
        FROM matches m
        JOIN match_sides ms ON m.id = ms.match_id
        JOIN tournament_entries te ON ms.entry_id = te.id
        WHERE m.tournament_id = ${tournamentId}
          ${excludeMatchId ? sql`AND m.id != ${excludeMatchId}` : sql``}
          AND EXISTS (
             SELECT 1 FROM tournament_entry_players tep1 
             WHERE tep1.entry_id = te.id AND tep1.player_id = ${userId}
          )
          AND EXISTS (
             SELECT 1 FROM tournament_entry_players tep2
             WHERE tep2.entry_id = te.id AND tep2.player_id = ${partnerId}
          )
    `);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Count matches against same opponent
   */
  async countMatchesWithSameOpponent(
    tournamentId: string,
    userId: string,
    opponentId: string,
    excludeMatchId?: string
  ) {
    // Two users are opponents if they are in DIFFERENT TournamentEntries (Sides) of the SAME Match

    // Logic:
    // Match M
    // Side S1 -> Entry E1 -> Player User
    // Side S2 -> Entry E2 -> Player Opponent
    // S1 != S2

    const result = await db.execute(sql`
        SELECT COUNT(DISTINCT m.id) as count
        FROM matches m
        JOIN match_sides s1 ON m.id = s1.match_id
        JOIN tournament_entries e1 ON s1.entry_id = e1.id
        JOIN tournament_entry_players tep1 ON e1.id = tep1.entry_id
        
        JOIN match_sides s2 ON m.id = s2.match_id
        JOIN tournament_entries e2 ON s2.entry_id = e2.id
        JOIN tournament_entry_players tep2 ON e2.id = tep2.entry_id
        
        WHERE m.tournament_id = ${tournamentId}
          ${excludeMatchId ? sql`AND m.id != ${excludeMatchId}` : sql``}
          AND tep1.player_id = ${userId}
          AND tep2.player_id = ${opponentId}
          AND s1.id != s2.id
    `);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Check if user is in match
   */
  async isUserInMatch(matchId: string, userId: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(and(
        eq(matchSides.matchId, matchId),
        eq(tournamentEntryPlayers.playerId, userId)
      ));

    return (result[0]?.count ?? 0) > 0;
  }

  /**
   * Get tournament by ID (for validation)
   */
  async getTournament(tournamentId: string) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
  }

  // syncOpponentsFromParticipants removed or adapted? 
  // It was used for compatibility with brackets-manager which expects opponent1/opponent2 in match table.
  // In new schema we still have opponent1/opponent2 jsonb fields in matches.
  // So we should adapt it to read from matchSides.

  /**
   * Update scores for match sides
   */
  async updateSideScores(matchId: string, scoreA: number | null, scoreB: number | null) {
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
      orderBy: (matchSides, { asc }) => [asc(matchSides.position)],
    });

    if (sides.length >= 2) {
      if (scoreA !== null && sides[0]) {
        await db.update(matchSides).set({ score: scoreA }).where(eq(matchSides.id, sides[0].id));
      }
      if (scoreB !== null && sides[1]) {
        await db.update(matchSides).set({ score: scoreB }).where(eq(matchSides.id, sides[1].id));
      }
    }
  }

  async syncOpponentsFromParticipants(matchId: string) {
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
      orderBy: (matchSides, { asc }) => [asc(matchSides.position)],
      with: {
        entry: true
      }
    });

    const p1 = sides[0];
    const p2 = sides[1];

    // Format depends on what brackets-manager expects. Assuming similar structure.
    const opponent1 = p1 ? {
      id: p1.entryId, // Or teamId if entry has it? Bracket manager usually wants participant ID.
      position: p1.position,
      score: p1.score,
      result: p1.score != null ? (p1.score > (p2?.score ?? -1) ? 'win' : 'loss') : null // Simplified logic
    } : null;

    const opponent2 = p2 ? {
      id: p2.entryId,
      position: p2.position,
      score: p2.score,
      result: p2.score != null ? (p2.score > (p1?.score ?? -1) ? 'win' : 'loss') : null
    } : null;

    await db.update(matches)
      .set({ opponent1, opponent2 })
      .where(eq(matches.id, matchId));
  }
  // ... inside MatchRepository class

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
      // Check in tournamentEntryPlayers
      const entryPlayer = await db.select()
        .from(tournamentEntryPlayers)
        .innerJoin(tournamentEntries, eq(tournamentEntryPlayers.entryId, tournamentEntries.id))
        .where(and(
          eq(tournamentEntries.tournamentId, tournamentId),
          eq(tournamentEntryPlayers.playerId, playerId)
        ))
        .limit(1);

      if (entryPlayer.length === 0) {
        throw new Error(`Joueur ${playerId} n'est pas inscrit au tournoi`);
      }
    }
  }

  /**
   * Get all participations for a match
   */
  async getParticipationsByMatchId(matchId: string) {
    // Retrieve sides -> entry -> players
    const result = await db
      .select({
        player: appUsers
      })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .innerJoin(appUsers, eq(tournamentEntryPlayers.playerId, appUsers.id))
      .where(eq(matchSides.matchId, matchId));

    return result.map(r => ({ player: r.player }));
  }
}

export const matchRepository = new MatchRepository();

