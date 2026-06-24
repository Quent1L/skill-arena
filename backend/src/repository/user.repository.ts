import { eq, or, ilike, sql } from "drizzle-orm";
import { db } from "../config/database";
import { appUsers } from "../db/schema";

export class UserRepository {
  /**
   * Get app_user by external ID
   */
  async getByExternalId(betterAuthUserId: string) {
    return await db.query.appUsers.findFirst({
      where: eq(appUsers.externalId, betterAuthUserId),
    });
  }

  async getById(id: string) {
    return await db.query.appUsers.findFirst({
      where: eq(appUsers.id, id),
    });
  }

  async createAppUser(appUser: typeof appUsers.$inferInsert) {
    const [createdUser] = await db.insert(appUsers).values(appUser).returning();
    return createdUser;
  }

  async incrementTrustScore(userId: string): Promise<void> {
    await db
      .update(appUsers)
      .set({ trustScoreCount: sql`${appUsers.trustScoreCount} + 1` })
      .where(eq(appUsers.id, userId))
  }

  async resetTrustScore(userId: string): Promise<void> {
    await db.update(appUsers).set({ trustScoreCount: 0 }).where(eq(appUsers.id, userId))
  }

  async updateAppUser(id: string, data: { displayName?: string; shortName?: string }) {
    const [updated] = await db
      .update(appUsers)
      .set(data)
      .where(eq(appUsers.id, id))
      .returning();
    return updated;
  }

  /**
   * Search users by display name or short name (case-insensitive)
   */
  async searchByName(query: string, limit = 10) {
    const pattern = `%${query}%`;
    return await db.query.appUsers.findMany({
      where: or(ilike(appUsers.displayName, pattern), ilike(appUsers.shortName, pattern)),
      columns: { id: true, displayName: true, shortName: true },
      orderBy: (users, { asc }) => [asc(users.displayName)],
      limit,
    });
  }

  /**
   * Get all users (for admin use)
   */
  async getAllUsers() {
    return await db.query.appUsers.findMany({
      with: {
        externalUser: {
          columns: {
            id: true,
            email: true,
            name: true,
            image: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
  }
}

export const userRepository = new UserRepository();
