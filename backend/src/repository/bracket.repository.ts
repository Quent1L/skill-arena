import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { matches } from "../db/schema";
import type { BracketMatch } from "../types/bracket";

export class BracketRepository {
  /**
   * Persist generated bracket matches and wire next match references.
   * Mutates the input matches with generated IDs so callers can use them immediately.
   */
  async saveBracketMatches(bracketMatches: BracketMatch[]): Promise<void> {
    await db.transaction(async (tx) => {
      const sequenceToId = new Map<number, string>();

      for (const match of bracketMatches) {
        const [inserted] = await tx
          .insert(matches)
          .values({
            tournamentId: match.tournamentId,
            round: match.round,
            sequence: match.sequence,
            bracketType: match.bracketType,
            matchPosition: match.matchPosition,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            status: "scheduled",
          })
          .returning({ id: matches.id });

        sequenceToId.set(match.sequence, inserted.id);
        match.id = inserted.id;
      }

      for (const match of bracketMatches) {
        const matchId = match.id;
        if (!matchId) continue;

        const updates: {
          nextMatchWinId?: string;
          nextMatchLoseId?: string;
        } = {};

        if (match.nextMatchWinId?.startsWith("TEMP_")) {
          const targetSeq = Number(match.nextMatchWinId.replace("TEMP_", ""));
          const targetId = sequenceToId.get(targetSeq);
          if (targetId) {
            updates.nextMatchWinId = targetId;
            match.nextMatchWinId = targetId;
          }
        }

        if (match.nextMatchLoseId?.startsWith("TEMP_")) {
          const targetSeq = Number(match.nextMatchLoseId.replace("TEMP_", ""));
          const targetId = sequenceToId.get(targetSeq);
          if (targetId) {
            updates.nextMatchLoseId = targetId;
            match.nextMatchLoseId = targetId;
          }
        }

        if (Object.keys(updates).length > 0) {
          await tx
            .update(matches)
            .set(updates)
            .where(eq(matches.id, matchId));
        }
      }
    });
  }
}

export const bracketRepository = new BracketRepository();
