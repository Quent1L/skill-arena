import { eq, and, ne, sql, count, inArray, or } from "drizzle-orm";
import { db } from "../config/database";
import {
  matches,
  matchSides,
  tournamentEntries,
  tournamentEntryPlayers,
  teams,
  tournaments,
  appUsers,
  tournamentParticipants,
} from "../db/schema";
import { type MatchStatus, type MatchFinalizationReason } from "@skill-arena/shared";
import { entryRepository } from "./entry.repository";
import { matchSidesRepository } from "./match-sides.repository";
import { matchResultRepository } from "./match-result.repository";

// Type for synthetic team object
type AppUser = typeof appUsers.$inferSelect;

export interface SyntheticTeamParticipant {
  user: AppUser;
}

export interface SyntheticTeam {
  id?: string;
  name?: string | null;
  participants: SyntheticTeamParticipant[];
}

export interface CreateMatchData {
  tournamentId: string;
  teamAId?: string;
  teamBId?: string;
  playerIdsA?: string[];
  playerIdsB?: string[];
  scoreA?: number;
  scoreB?: number;
  winner?: "teamA" | "teamB" | null;
  status?: MatchStatus;
  reportedBy?: string;
  reportProof?: string;
  confirmationDeadline?: Date;
  playedAt?: Date;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
}

export interface UpdateMatchData {
  scoreA?: number;
  scoreB?: number;
  status?: MatchStatus;
  reportProof?: string;
  confirmationDeadline?: Date;
  finalizedAt?: Date;
  finalizedBy?: string;
  finalizationReason?: MatchFinalizationReason;
  playedAt?: Date;
  outcomeTypeId?: string;
  outcomeReasonId?: string;
}

export interface MatchFilters {
  tournamentId?: string;
  status?: MatchStatus;
}

export class MatchRepository {
  /**
   * Create a new match
   */
  async create(data: CreateMatchData) {
    return await db.transaction(async (tx) => {
      // 1. Create match record (no teamIds/scores anymore)
      const [match] = await tx
        .insert(matches)
        .values({
          tournamentId: data.tournamentId,
          status: data.status ?? "scheduled",
          playedAt: data.playedAt ?? new Date(),
          confirmationDeadline: data.confirmationDeadline,
          outcomeTypeId: data.outcomeTypeId,
          outcomeReasonId: data.outcomeReasonId,
        })
        .returning();

      // 2. Get tournament for points calculation
      const tournament = await this.getTournament(data.tournamentId);
      if (!tournament) {
        throw new Error("Tournament not found");
      }

      // 3. Get or create entries
      const entryA = await entryRepository.getOrCreateForMatch(
        data.tournamentId,
        data.teamAId,
        data.playerIdsA,
        tx
      );
      const entryB = await entryRepository.getOrCreateForMatch(
        data.tournamentId,
        data.teamBId,
        data.playerIdsB,
        tx
      );

      if (!entryA || !entryB) {
        throw new Error("Failed to create or find entries");
      }

      // 4. Determine winner and calculate points
      const scoreA = data.scoreA ?? 0;
      const scoreB = data.scoreB ?? 0;
      const isDraw = data.winner === null || scoreA === scoreB;
      const isAWinner = data.winner === "teamA" || (data.winner === undefined && scoreA > scoreB);

      const pointsA = isDraw
        ? tournament.pointPerDraw ?? 1
        : isAWinner
        ? tournament.pointPerVictory ?? 3
        : tournament.pointPerLoss ?? 0;
      const pointsB = isDraw
        ? tournament.pointPerDraw ?? 1
        : isAWinner
        ? tournament.pointPerLoss ?? 0
        : tournament.pointPerVictory ?? 3;

      // 5. Create match_sides
      await matchSidesRepository.createSides(
        match.id,
        [
          {
            entryId: entryA.id,
            position: 1,
            score: scoreA,
            pointsAwarded: pointsA,
          },
          {
            entryId: entryB.id,
            position: 2,
            score: scoreB,
            pointsAwarded: pointsB,
          },
        ],
        tx
      );

      // 6. Create match_results if reported
      if (data.status && ["reported", "confirmed", "finalized"].includes(data.status)) {
        await matchResultRepository.create(
          match.id,
          {
            reportedBy: data.reportedBy,
            reportedAt: new Date(),
            reportProof: data.reportProof,
          },
          tx
        );
      }

      return match.id;
    });
  }

  /**
   * Get match by ID with relations
   * Builds synthetic teamA/teamB from match_sides for backward compatibility
   */
  async getById(id: string) {
    const match = await db.query.matches.findFirst({
      where: eq(matches.id, id),
      with: {
        tournament: true,
        outcomeType: {
          with: {
            discipline: true,
          },
        },
        outcomeReason: {
          with: {
            outcomeType: {
              with: {
                discipline: true,
              },
            },
          },
        },
        confirmations: {
          with: {
            player: true,
          },
        },
      },
    });

    if (!match) return match;

    // Get match_sides
    const sides = await matchSidesRepository.getByMatchId(id);

    // Get match_results
    const result = await matchResultRepository.getByMatchId(id);

    // Build synthetic teamA/teamB objects
    const teamA = sides[0] ? this.buildTeamObject(sides[0]) : null;
    const teamB = sides[1] ? this.buildTeamObject(sides[1]) : null;

    // Determine winner info
    const scoreA = sides[0]?.score ?? 0;
    const scoreB = sides[1]?.score ?? 0;
    const winnerSide = this.determineWinnerSide(sides);
    const winnerId =
      winnerSide === "A"
        ? sides[0]?.entry?.teamId || sides[0]?.entry?.id
        : winnerSide === "B"
        ? sides[1]?.entry?.teamId || sides[1]?.entry?.id
        : null;

    // Build response with backward-compatible format
    return {
      ...match,
      teamA: teamA as any,
      teamB: teamB as any,
      scoreA,
      scoreB,
      winnerId,
      winnerSide,
      winner: winnerId ? (winnerSide === "A" ? teamA : teamB) : null,
      reportedBy: result?.reportedBy,
      reportedAt: result?.reportedAt,
      reportProof: result?.reportProof,
      finalizedBy: result?.finalizedBy,
      finalizedAt: result?.finalizedAt,
      finalizationReason: result?.finalizationReason,
      reporter: result?.reporter,
      // Include sides for new API consumers
      sides: sides,
    };
  }

  /**
   * Build team object from match side
   */
  private buildTeamObject(side: any): SyntheticTeam {
    const entry = side.entry;
    if (!entry) {
      return { participants: [] };
    }

    if (entry.entryType === "TEAM" && entry.team) {
      return {
        id: entry.team.id,
        name: entry.team.name,
        participants: entry.players.map((ep: any) => ({
          user: ep.player,
        })),
      };
    } else {
      // PLAYER entry - synthetic team
      return {
        id: entry.id, // Use entryId as synthetic teamId
        name: null,
        participants: entry.players.map((ep: any) => ({
          user: ep.player,
        })),
      };
    }
  }

  /**
   * Determine winner side from match sides
   */
  private determineWinnerSide(sides: any[]): "A" | "B" | null {
    if (!sides[0] || !sides[1]) return null;
    if (sides[0].score > sides[1].score) return "A";
    if (sides[1].score > sides[0].score) return "B";
    return null; // draw
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

    const matchList = await db.query.matches.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tournament: true,
        outcomeType: {
          with: {
            discipline: true,
          },
        },
        outcomeReason: {
          with: {
            outcomeType: {
              with: {
                discipline: true,
              },
            },
          },
        },
      },
      orderBy: (matches, { desc }) => [desc(matches.createdAt)],
    });

    // Build full match objects with synthetic teams
    const processed = await Promise.all(
      matchList.map(async (m) => {
        const sides = await matchSidesRepository.getByMatchId(m.id);
        const result = await matchResultRepository.getByMatchId(m.id);

        const teamA = sides[0] ? this.buildTeamObject(sides[0]) : null;
        const teamB = sides[1] ? this.buildTeamObject(sides[1]) : null;
        const scoreA = sides[0]?.score ?? 0;
        const scoreB = sides[1]?.score ?? 0;
        const winnerSide = this.determineWinnerSide(sides);
        const winnerId =
          winnerSide === "A"
            ? sides[0]?.entry?.teamId || sides[0]?.entry?.id
            : winnerSide === "B"
            ? sides[1]?.entry?.teamId || sides[1]?.entry?.id
            : null;

        return {
          ...m,
          teamA: teamA as any,
          teamB: teamB as any,
          scoreA,
          scoreB,
          winnerId,
          winnerSide,
          winner: winnerId ? (winnerSide === "A" ? teamA : teamB) : null,
          reportedBy: result?.reportedBy,
          reportedAt: result?.reportedAt,
          reportProof: result?.reportProof,
          finalizedBy: result?.finalizedBy,
          finalizedAt: result?.finalizedAt,
          finalizationReason: result?.finalizationReason,
          reporter: result?.reporter,
          sides: sides,
        };
      })
    );

    return processed;
  }

  /**
   * Update match
   */
  async update(id: string, data: UpdateMatchData) {
    return await db.transaction(async (tx) => {
      // Update match record
      const [updated] = await tx
        .update(matches)
        .set({
          status: data.status,
          playedAt: data.playedAt,
          outcomeTypeId: data.outcomeTypeId,
          outcomeReasonId: data.outcomeReasonId,
          confirmationDeadline: data.confirmationDeadline,
        })
        .where(eq(matches.id, id))
        .returning();

      // Update match_sides scores if provided
      if (data.scoreA !== undefined || data.scoreB !== undefined) {
        const sides = await matchSidesRepository.getByMatchId(id);
        const updates = [];

        if (data.scoreA !== undefined && sides[0]) {
          updates.push({ entryId: sides[0].entryId, score: data.scoreA });
        }
        if (data.scoreB !== undefined && sides[1]) {
          updates.push({ entryId: sides[1].entryId, score: data.scoreB });
        }

        if (updates.length > 0) {
          await matchSidesRepository.updateScores(id, updates);
        }

        // Recalculate points if scores changed
        if (data.scoreA !== undefined || data.scoreB !== undefined) {
          const tournament = await this.getTournament(updated.tournamentId);
          if (tournament) {
            const scoreA = data.scoreA ?? sides[0]?.score ?? 0;
            const scoreB = data.scoreB ?? sides[1]?.score ?? 0;
            const isDraw = scoreA === scoreB;
            const isAWinner = scoreA > scoreB;

            const pointsA = isDraw
              ? tournament.pointPerDraw ?? 1
              : isAWinner
              ? tournament.pointPerVictory ?? 3
              : tournament.pointPerLoss ?? 0;
            const pointsB = isDraw
              ? tournament.pointPerDraw ?? 1
              : isAWinner
              ? tournament.pointPerLoss ?? 0
              : tournament.pointPerVictory ?? 3;

            if (sides[0]) {
              await matchSidesRepository.updatePointsAwarded(
                id,
                sides[0].entryId,
                pointsA
              );
            }
            if (sides[1]) {
              await matchSidesRepository.updatePointsAwarded(
                id,
                sides[1].entryId,
                pointsB
              );
            }
          }
        }
      }

      // Update or create match_results
      const existingResult = await matchResultRepository.getByMatchId(id);

      if (data.reportProof !== undefined || data.finalizedBy !== undefined) {
        if (existingResult) {
          await matchResultRepository.update(id, {
            reportProof: data.reportProof,
            finalizedBy: data.finalizedBy,
            finalizedAt: data.finalizedAt,
            finalizationReason: data.finalizationReason,
          });
        } else {
          await matchResultRepository.create(id, {
            reportProof: data.reportProof,
            finalizedBy: data.finalizedBy,
            finalizedAt: data.finalizedAt,
            finalizationReason: data.finalizationReason,
          });
        }
      }

      return updated;
    });
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
  async countMatchesForUser(
    tournamentId: string,
    userId: string,
    excludeMatchId?: string
  ) {
    const matchConditions = [eq(matches.tournamentId, tournamentId)];
    if (excludeMatchId) {
      matchConditions.push(ne(matches.id, excludeMatchId));
    }

    // Get all entries where this user participates
    const userEntries = await db
      .select({ entryId: tournamentEntryPlayers.entryId })
      .from(tournamentEntryPlayers)
      .innerJoin(
        tournamentEntries,
        eq(tournamentEntryPlayers.entryId, tournamentEntries.id)
      )
      .where(
        and(
          eq(tournamentEntryPlayers.playerId, userId),
          eq(tournamentEntries.tournamentId, tournamentId)
        )
      );

    if (userEntries.length === 0) {
      return 0;
    }

    const entryIds = userEntries.map((e) => e.entryId);

    // Count matches where user's entries are involved
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${matches.id})` })
      .from(matches)
      .innerJoin(
        sql`match_sides`,
        sql`${matches.id} = match_sides.match_id`
      )
      .where(
        and(
          ...matchConditions,
          sql`match_sides.entry_id IN ${entryIds}`
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count matches between same players (partners)
   * For flex tournaments, only counts matches with the same team size
   */
  async countMatchesWithSamePartner(
    tournamentId: string,
    userId: string,
    partnerId: string,
    excludeMatchId?: string,
    teamSize?: number
  ) {
    // Get entries where both users are together
    const userEntries = await db
      .select({ entryId: tournamentEntryPlayers.entryId })
      .from(tournamentEntryPlayers)
      .innerJoin(
        tournamentEntries,
        eq(tournamentEntryPlayers.entryId, tournamentEntries.id)
      )
      .where(
        and(
          eq(tournamentEntryPlayers.playerId, userId),
          eq(tournamentEntries.tournamentId, tournamentId)
        )
      );

    if (userEntries.length === 0) {
      return 0;
    }

    let count = 0;
    for (const { entryId } of userEntries) {
      // Check if partner is also in this entry
      const partnerInEntry = await db.query.tournamentEntryPlayers.findFirst({
        where: and(
          eq(tournamentEntryPlayers.entryId, entryId),
          eq(tournamentEntryPlayers.playerId, partnerId)
        ),
      });

      if (!partnerInEntry) continue;

      // Get entry details
      const entry = await entryRepository.getById(entryId);
      if (!entry) continue;

      // If teamSize specified, check it matches
      if (teamSize !== undefined && entry.players.length !== teamSize) {
        continue;
      }

      // Count matches with this entry
      const matchConditions = [eq(matches.tournamentId, tournamentId)];
      if (excludeMatchId) {
        matchConditions.push(ne(matches.id, excludeMatchId));
      }

      const entryMatches = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${matches.id})` })
        .from(matches)
        .innerJoin(
          sql`match_sides`,
          sql`${matches.id} = match_sides.match_id`
        )
        .where(
          and(
            ...matchConditions,
            sql`match_sides.entry_id = ${entryId}`
          )
        );

      count += entryMatches[0]?.count ?? 0;
    }

    return count;
  }

  /**
   * Count matches against same opponent
   */
  async countMatchesWithSameOpponent(
    tournamentId: string,
    userId: string,
    opponentId: string,
    excludeMatchId?: string,
    teamSize?: number
  ) {
    // Get user's entries
    const userEntries = await db
      .select({ entryId: tournamentEntryPlayers.entryId })
      .from(tournamentEntryPlayers)
      .innerJoin(
        tournamentEntries,
        eq(tournamentEntryPlayers.entryId, tournamentEntries.id)
      )
      .where(
        and(
          eq(tournamentEntryPlayers.playerId, userId),
          eq(tournamentEntries.tournamentId, tournamentId)
        )
      );

    // Get opponent's entries
    const opponentEntries = await db
      .select({ entryId: tournamentEntryPlayers.entryId })
      .from(tournamentEntryPlayers)
      .innerJoin(
        tournamentEntries,
        eq(tournamentEntryPlayers.entryId, tournamentEntries.id)
      )
      .where(
        and(
          eq(tournamentEntryPlayers.playerId, opponentId),
          eq(tournamentEntries.tournamentId, tournamentId)
        )
      );

    if (userEntries.length === 0 || opponentEntries.length === 0) {
      return 0;
    }

    // If teamSize is specified, filter entries by team size
    let userEntryIds = userEntries.map((e) => e.entryId);
    let opponentEntryIds = opponentEntries.map((e) => e.entryId);

    if (teamSize !== undefined) {
      // Get full entry details to check team size
      const userEntriesDetails = await Promise.all(
        userEntryIds.map((id) => entryRepository.getById(id))
      );
      const opponentEntriesDetails = await Promise.all(
        opponentEntryIds.map((id) => entryRepository.getById(id))
      );

      userEntryIds = userEntriesDetails
        .filter((e) => e && e.players.length === teamSize)
        .map((e) => e!.id);

      opponentEntryIds = opponentEntriesDetails
        .filter((e) => e && e.players.length === teamSize)
        .map((e) => e!.id);

      if (userEntryIds.length === 0 || opponentEntryIds.length === 0) {
        return 0;
      }
    }

    // Find matches where user and opponent entries face each other
    const matchConditions = [eq(matches.tournamentId, tournamentId)];
    if (excludeMatchId) {
      matchConditions.push(ne(matches.id, excludeMatchId));
    }

    // Use a Set to track unique match IDs
    const matchedMatchIds = new Set<string>();

    const opposingMatches = await db
      .select({ matchId: sql<string>`match_sides.match_id` })
      .from(sql`match_sides`)
      .innerJoin(matches, sql`matches.id = match_sides.match_id`)
      .where(
        and(
          ...matchConditions,
          inArray(sql`match_sides.entry_id`, userEntryIds)
        )
      );

    for (const { matchId } of opposingMatches) {
      // Skip if we've already counted this match
      if (matchedMatchIds.has(matchId)) {
        continue;
      }

      // Get user's side position
      const userSide = await db
        .select({ position: sql<number>`match_sides.position` })
        .from(sql`match_sides`)
        .where(
          and(
            sql`match_sides.match_id = ${matchId}`,
            inArray(sql`match_sides.entry_id`, userEntryIds)
          )
        )
        .limit(1);

      if (userSide.length === 0) {
        continue;
      }

      const userPosition = userSide[0].position;

      // Check if opponent is also in this match (on the opposite side)
      const opponentSide = await db
        .select({ position: sql<number>`match_sides.position` })
        .from(sql`match_sides`)
        .where(
          and(
            sql`match_sides.match_id = ${matchId}`,
            inArray(sql`match_sides.entry_id`, opponentEntryIds)
          )
        )
        .limit(1);

      // Only count if they are on opposite sides (different positions)
      if (opponentSide.length > 0 && opponentSide[0].position !== userPosition) {
        matchedMatchIds.add(matchId);
      }
    }

    return matchedMatchIds.size;
  }

  /**
   * Check if user is participant in match
   */
  async isUserInMatch(matchId: string, userId: string): Promise<boolean> {
    // Get match sides
    const sides = await matchSidesRepository.getByMatchId(matchId);

    for (const side of sides) {
      const isInEntry = await entryRepository.isPlayerInEntry(
        side.entryId,
        userId
      );
      if (isInEntry) {
        return true;
      }
    }

    return false;
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
   * Validate that entries belong to tournament and players are registered
   */
  async validateEntriesForTournament(
    tournamentId: string,
    teamAId?: string,
    teamBId?: string,
    playerIdsA?: string[],
    playerIdsB?: string[]
  ) {
    // For static teams: validate team IDs
    if (teamAId) {
      const teamA = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamAId), eq(teams.tournamentId, tournamentId)),
      });
      if (!teamA) {
        throw new Error("TEAM_A_NOT_FOUND");
      }
    }

    if (teamBId) {
      const teamB = await db.query.teams.findFirst({
        where: and(eq(teams.id, teamBId), eq(teams.tournamentId, tournamentId)),
      });
      if (!teamB) {
        throw new Error("TEAM_B_NOT_FOUND");
      }
    }

    if (teamAId && teamBId && teamAId === teamBId) {
      throw new Error("TEAMS_CANNOT_BE_SAME");
    }

    // For flex teams: validate player IDs
    const allPlayerIds = [...(playerIdsA || []), ...(playerIdsB || [])];
    if (allPlayerIds.length > 0) {
      // Check all players are registered in tournamentParticipants
      for (const playerId of allPlayerIds) {
        const participant = await db.query.tournamentParticipants.findFirst({
          where: and(
            eq(tournamentParticipants.userId, playerId),
            eq(tournamentParticipants.tournamentId, tournamentId),
            eq(tournamentParticipants.status, "active")
          ),
        });
        if (!participant) {
          throw new Error(`PLAYER_NOT_REGISTERED: ${playerId}`);
        }
      }
    }
  }

  /**
   * Get all participations for a match (returns match sides with player info)
   */
  async getParticipationsByMatchId(matchId: string) {
    const sides = await matchSidesRepository.getByMatchId(matchId);

    // Build participation-like objects for backward compatibility
    const participations = [];
    for (const side of sides) {
      const teamSide = side.position === 1 ? "A" : "B";
      for (const playerLink of side.entry?.players || []) {
        participations.push({
          matchId,
          playerId: playerLink.player.id,
          player: playerLink.player,
          teamSide,
        });
      }
    }

    return participations;
  }

  /**
   * Find matches with the same entries in a tournament
   * Used for duplicate detection
   */
  async findMatchesWithSameEntries(
    tournamentId: string,
    entryAId: string,
    entryBId: string,
    excludeMatchId?: string
  ): Promise<string[]> {
    // Step 1: Find all matches in the tournament that contain either entry
    const matchesWithEntries = await db
      .select({
        matchId: matchSides.matchId,
        entryIds: sql<string[]>`array_agg(DISTINCT ${matchSides.entryId})`,
      })
      .from(matchSides)
      .innerJoin(matches, eq(matchSides.matchId, matches.id))
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          or(
            eq(matchSides.entryId, entryAId),
            eq(matchSides.entryId, entryBId)
          ),
          excludeMatchId ? ne(matches.id, excludeMatchId) : sql`true`
        )
      )
      .groupBy(matchSides.matchId)
      .having(sql`count(DISTINCT ${matchSides.entryId}) = 2`);

    // Step 2: Filter to only matches where BOTH entries are present
    const duplicateMatchIds: string[] = [];
    for (const match of matchesWithEntries) {
      const entries = match.entryIds;
      if (entries.includes(entryAId) && entries.includes(entryBId)) {
        duplicateMatchIds.push(match.matchId);
      }
    }

    return duplicateMatchIds;
  }
}

export const matchRepository = new MatchRepository();
