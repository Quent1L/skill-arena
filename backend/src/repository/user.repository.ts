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
