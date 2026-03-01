import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { matchConfirmations, appUsers } from "../db/schema";

export interface CreateMatchConfirmationData {
  matchId: string;
  playerId: string;
  isConfirmed: boolean;
  isContested: boolean;
  contestationReason?: string;
  contestationProof?: string;
  proposedScoreA?: number | null;
  proposedScoreB?: number | null;
  proposedWinner?: string | null;
  proposedOutcomeTypeId?: string | null;
  proposedOutcomeReasonId?: string | null;
}

export interface UpdateMatchConfirmationData {
  isConfirmed?: boolean;
  isContested?: boolean;
  contestationReason?: string;
  contestationProof?: string;
  proposedScoreA?: number | null;
  proposedScoreB?: number | null;
  proposedWinner?: string | null;
  proposedOutcomeTypeId?: string | null;
  proposedOutcomeReasonId?: string | null;
}

export class MatchConfirmationRepository {
  /**
   * Create a new match confirmation
   */
  async create(data: CreateMatchConfirmationData) {
    const [confirmation] = await db
      .insert(matchConfirmations)
      .values(data)
      .returning();
    return confirmation;
  }

  /**
   * Get confirmation by match and player
   */
  async getByMatchAndPlayer(matchId: string, playerId: string) {
    const confirmation = await db.query.matchConfirmations.findFirst({
      where: and(
        eq(matchConfirmations.matchId, matchId),
        eq(matchConfirmations.playerId, playerId)
      ),
      with: {
        player: true,
      },
    });
    return confirmation;
  }

  /**
   * Get all confirmations for a match
   */
  async getByMatchId(matchId: string) {
    const confirmations = await db.query.matchConfirmations.findMany({
      where: eq(matchConfirmations.matchId, matchId),
      with: {
        player: true,
      },
    });
    return confirmations;
  }

  /**
   * Update a match confirmation
   */
  async update(matchId: string, playerId: string, data: UpdateMatchConfirmationData) {
    const [confirmation] = await db
      .update(matchConfirmations)
      .set(data)
      .where(
        and(
          eq(matchConfirmations.matchId, matchId),
          eq(matchConfirmations.playerId, playerId)
        )
      )
      .returning();
    return confirmation;
  }

  /**
   * Upsert a match confirmation (insert or update if exists)
   */
  async upsert(data: CreateMatchConfirmationData) {
    const existing = await this.getByMatchAndPlayer(data.matchId, data.playerId);
    
    if (existing) {
      return await this.update(data.matchId, data.playerId, {
        isConfirmed: data.isConfirmed,
        isContested: data.isContested,
        contestationReason: data.contestationReason,
        contestationProof: data.contestationProof,
        proposedScoreA: data.proposedScoreA,
        proposedScoreB: data.proposedScoreB,
        proposedWinner: data.proposedWinner,
        proposedOutcomeTypeId: data.proposedOutcomeTypeId,
        proposedOutcomeReasonId: data.proposedOutcomeReasonId,
      });
    }
    
    return await this.create(data);
  }

  /**
   * Reset all confirmations for a match except for the given player.
   * Used when a new score proposal replaces the previous one.
   */
  async resetConfirmationsExcept(matchId: string, excludePlayerId: string) {
    const confirmations = await this.getByMatchId(matchId);
    const toReset = confirmations.filter((c) => c.playerId !== excludePlayerId);

    for (const c of toReset) {
      await db
        .update(matchConfirmations)
        .set({
          isConfirmed: false,
          isContested: false,
          contestationReason: null,
          contestationProof: null,
          proposedScoreA: null,
          proposedScoreB: null,
          proposedWinner: null,
          proposedOutcomeTypeId: null,
          proposedOutcomeReasonId: null,
        })
        .where(
          and(
            eq(matchConfirmations.matchId, matchId),
            eq(matchConfirmations.playerId, c.playerId)
          )
        );
    }
  }

  /**
   * Get the most recent active score proposal for a match.
   * Returns the confirmation with non-null proposedScoreA/B, ordered by updatedAt desc.
   */
  async getActiveProposal(matchId: string) {
    const confirmations = await this.getByMatchId(matchId);
    const proposals = confirmations.filter(
      (c) => c.proposedScoreA !== null && c.proposedScoreA !== undefined &&
             c.proposedScoreB !== null && c.proposedScoreB !== undefined
    );
    if (proposals.length === 0) return null;
    // Most recently updated proposal (copy to avoid mutating the filtered array)
    return [...proposals].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }

  /**
   * Delete a match confirmation
   */
  async delete(matchId: string, playerId: string) {
    await db
      .delete(matchConfirmations)
      .where(
        and(
          eq(matchConfirmations.matchId, matchId),
          eq(matchConfirmations.playerId, playerId)
        )
      );
  }

  /**
   * Delete all confirmations for a match
   */
  async deleteByMatchId(matchId: string) {
    await db
      .delete(matchConfirmations)
      .where(eq(matchConfirmations.matchId, matchId));
  }

  /**
   * Count confirmations for a match
   */
  async countConfirmationsByMatch(matchId: string) {
    const confirmations = await this.getByMatchId(matchId);
    
    return {
      total: confirmations.length,
      confirmed: confirmations.filter(c => c.isConfirmed).length,
      contested: confirmations.filter(c => c.isContested).length,
    };
  }

  /**
   * Check if a player has confirmed a match
   */
  async hasPlayerConfirmed(matchId: string, playerId: string): Promise<boolean> {
    const confirmation = await this.getByMatchAndPlayer(matchId, playerId);
    return confirmation?.isConfirmed || false;
  }

  /**
   * Check if a player has contested a match
   */
  async hasPlayerContested(matchId: string, playerId: string): Promise<boolean> {
    const confirmation = await this.getByMatchAndPlayer(matchId, playerId);
    return confirmation?.isContested || false;
  }

  /**
   * Check if any player has contested a match
   */
  async hasAnyContestation(matchId: string): Promise<boolean> {
    const confirmations = await this.getByMatchId(matchId);
    return confirmations.some(c => c.isContested);
  }
}

export const matchConfirmationRepository = new MatchConfirmationRepository();

