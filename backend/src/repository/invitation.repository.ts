import { eq, sql } from "drizzle-orm";
import { db } from "../config/database";
import { invitationCodes, invitationUsages } from "../db/schema";

export class InvitationRepository {
  async findByCode(code: string) {
    return await db.query.invitationCodes.findFirst({
      where: eq(invitationCodes.code, code),
      with: { usages: true },
    });
  }

  async create(data: typeof invitationCodes.$inferInsert) {
    const [code] = await db.insert(invitationCodes).values(data).returning();
    return code;
  }

  async incrementUsage(codeId: string) {
    const [updated] = await db
      .update(invitationCodes)
      .set({ usedCount: sql`${invitationCodes.usedCount} + 1` })
      .where(eq(invitationCodes.id, codeId))
      .returning();
    return updated;
  }

  async recordUsage(data: typeof invitationUsages.$inferInsert) {
    const [usage] = await db.insert(invitationUsages).values(data).returning();
    return usage;
  }

  async getAll() {
    return await db.query.invitationCodes.findMany({
      with: {
        creator: { columns: { id: true, displayName: true } },
        usages: { columns: { id: true, usedAt: true, email: true } },
      },
      orderBy: (codes, { desc }) => [desc(codes.createdAt)],
    });
  }

  async deactivate(codeId: string) {
    const [updated] = await db
      .update(invitationCodes)
      .set({ isActive: false })
      .where(eq(invitationCodes.id, codeId))
      .returning();
    return updated;
  }

  async hasUserUsedCode(userId: string): Promise<boolean> {
    const usage = await db.query.invitationUsages.findFirst({
      where: eq(invitationUsages.userId, userId),
    });
    return !!usage;
  }
}

export const invitationRepository = new InvitationRepository();
