import { userRepository } from "../repository/user.repository";

export class UserService {
  /**
   * Get or create app_user from BetterAuth external ID
   */
  async getOrCreateAppUser(
    betterAuthUserId: string,
    displayName: string
  ): Promise<string> {
    let appUser = await userRepository.getByExternalId(betterAuthUserId);

    appUser ??= await userRepository.createAppUser({
      externalId: betterAuthUserId,
      displayName: displayName,
      role: "player",
    });

    return appUser.id;
  }

  /**
   * Get app user details by ID
   */
  async getAppUserById(appUserId: string) {
    const appUser = await userRepository.getById(appUserId);

    if (!appUser) {
      throw new Error("User not found");
    }

    return appUser;
  }

  /**
   * Get app user details by Better Auth external ID
   */
  async getAppUserByExternalId(betterAuthUserId: string) {
    const appUser = await userRepository.getByExternalId(betterAuthUserId);

    if (!appUser) {
      throw new Error("User not found");
    }

    return appUser;
  }
}

export const userService = new UserService();
