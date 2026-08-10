import { asc, eq } from "drizzle-orm";
import { db } from "../config/database";
import { matchMessages } from "../db/schema";

export interface CreateMatchMessageData {
  matchId: string;
  authorId: string | null;
  kind: "user" | "system";
  body: string;
  translationParams?: Record<string, unknown> | null;
}

export class MatchMessageRepository {
  /**
   * Full thread of a match, oldest first.
   */
  async listByMatch(matchId: string) {
    return await db.query.matchMessages.findMany({
      where: eq(matchMessages.matchId, matchId),
      orderBy: [asc(matchMessages.createdAt)],
      with: { author: true },
    });
  }

  async create(data: CreateMatchMessageData) {
    const [message] = await db
      .insert(matchMessages)
      .values({
        matchId: data.matchId,
        authorId: data.authorId,
        kind: data.kind,
        body: data.body,
        translationParams: data.translationParams ?? null,
      })
      .returning();

    return message;
  }
}

export const matchMessageRepository = new MatchMessageRepository();
