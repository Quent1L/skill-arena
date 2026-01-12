import { db } from "../config/database";
import { matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { eq } from "drizzle-orm";

export enum ParticipantRole {
    HOME = 'HOME',
    AWAY = 'AWAY',
    SEED_1 = 'SEED_1',
    SEED_2 = 'SEED_2',
    SEED_3 = 'SEED_3',
    SEED_4 = 'SEED_4'
}

export interface CreateMatchParticipantData {
    matchId: string;
    teamId?: string;
    role: ParticipantRole;
    position: number;
    score?: number;
    isWinner?: boolean;
    players?: string[]; // IDs of players for flex mode
    entryId?: string; // Direct entry ID if known
}

export const matchParticipantRepository = {
    /**
     * Create a match side (participant) entry
     * This adapts the old API to the new schema using matchSides + tournamentEntries
     */
    async create(data: CreateMatchParticipantData) {
        let entryId = data.entryId;

        // If no entryId provided, we need to find or create an entry
        if (!entryId) {
            // For brackets, we typically work with teams
            if (data.teamId) {
                // Find existing entry for this team in the tournament
                const match = await db.query.matches.findFirst({
                    where: eq(matchSides.matchId, data.matchId),
                    with: { tournament: true }
                });

                if (match) {
                    const existingEntry = await db.query.tournamentEntries.findFirst({
                        where: eq(tournamentEntries.teamId, data.teamId)
                    });

                    if (existingEntry) {
                        entryId = existingEntry.id;
                    }
                }
            }
        }

        // If we still don't have an entryId, we can't create the side
        // In bracket scenarios, entries should pre-exist
        if (!entryId) {
            // For now, return a mock structure to maintain API compatibility
            // This shouldn't happen in production as entries should be created first
            console.warn('No entry found for match participant, creating placeholder');
            return {
                id: 'placeholder',
                matchId: data.matchId,
                teamId: data.teamId,
                role: data.role,
                position: data.position,
                score: data.score ?? 0,
                isWinner: data.isWinner ?? false,
            };
        }

        // Create the match side
        const [side] = await db
            .insert(matchSides)
            .values({
                matchId: data.matchId,
                entryId: entryId,
                position: data.position,
                score: data.score ?? null,
                pointsAwarded: null,
            })
            .returning();

        // Map to old API format for compatibility
        return {
            id: side.id,
            matchId: side.matchId,
            teamId: data.teamId,
            entryId: side.entryId,
            role: data.role,
            position: side.position,
            score: side.score ?? 0,
            isWinner: data.isWinner ?? false,
        };
    },

    /**
     * Get all participants for a match
     * Maps matchSides -> entries -> teams/players to the old format
     */
    async getByMatchId(matchId: string) {
        const sides = await db.query.matchSides.findMany({
            where: eq(matchSides.matchId, matchId),
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
        });

        // Map to old format for compatibility
        return sides.map(side => ({
            id: side.id,
            matchId: side.matchId,
            teamId: side.entry?.teamId ?? null,
            entryId: side.entryId,
            position: side.position,
            score: side.score ?? 0,
            isWinner: false, // Need to compute from scores if needed
            team: side.entry?.team ?? null,
            players: side.entry?.players?.map(p => ({
                player: p.player
            })) ?? [],
        }));
    },

    /**
     * Update score for a match side
     */
    async updateScore(sideId: string, score: number) {
        return await db
            .update(matchSides)
            .set({ score })
            .where(eq(matchSides.id, sideId))
            .returning();
    },

    /**
     * Set winner for a match (based on score comparison)
     * Note: In new schema, winner is determined by score, not a flag
     */
    async setWinner(matchId: string, winningSideId: string) {
        // In the new schema, we don't have an isWinner flag
        // Winner is determined by comparing scores
        // This method is kept for API compatibility
        const sides = await db.query.matchSides.findMany({
            where: eq(matchSides.matchId, matchId)
        });

        const winningSide = sides.find(s => s.id === winningSideId);
        if (winningSide) {
            return {
                id: winningSide.id,
                matchId: winningSide.matchId,
                entryId: winningSide.entryId,
                position: winningSide.position,
                score: winningSide.score,
                isWinner: true
            };
        }
        return null;
    },

    /**
     * Delete all sides for a match
     */
    async deleteByMatchId(matchId: string) {
        await db.delete(matchSides).where(eq(matchSides.matchId, matchId));
    }
};
