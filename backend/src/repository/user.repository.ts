import { eq } from "drizzle-orm";
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
}

export const userRepository = new UserRepository();
