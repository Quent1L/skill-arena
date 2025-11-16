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
}

export interface UpdateMatchConfirmationData {
  isConfirmed?: boolean;
  isContested?: boolean;
  contestationReason?: string;
  contestationProof?: string;
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
      });
    }
    
    return await this.create(data);
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

