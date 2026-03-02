import { userRepository } from "../repository/user.repository";
import { invitationRepository } from "../repository/invitation.repository";
import { ErrorCode, NotFoundError, UnauthorizedError } from "../types/errors";
import type { UpdateProfileInput } from "@skill-arena/shared";

export class UserService {
  /**
   * Get or create app_user from BetterAuth external ID
   */
  async getOrCreateAppUser(
    betterAuthUserId: string,
    displayName: string
  ): Promise<string> {
    let appUser = await userRepository.getByExternalId(betterAuthUserId);

    // Si le appUser existe déjà, le retourner
    if (appUser) {
      return appUser.id;
    }

    // Sinon, vérifier qu'un code d'invitation a été consommé avant de créer le appUser
    const hasValidInvitation = await invitationRepository.hasUserUsedCode(betterAuthUserId);

    if (!hasValidInvitation) {
      throw new UnauthorizedError(
        ErrorCode.INVITATION_CODE_REQUIRED,
        { betterAuthUserId }
      );
    }

    // Code d'invitation valide, créer le appUser
    appUser = await userRepository.createAppUser({
      externalId: betterAuthUserId,
      displayName: displayName,
      shortName: displayName.substring(0, 5).toUpperCase(),
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
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    return appUser;
  }

  /**
   * Get app user details by Better Auth external ID
   */
  async getAppUserByExternalId(betterAuthUserId: string) {
    const appUser = await userRepository.getByExternalId(betterAuthUserId);

    if (!appUser) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    return appUser;
  }

  /**
   * Update user profile (displayName and shortName)
   */
  async updateProfile(appUserId: string, data: UpdateProfileInput) {
    const appUser = await userRepository.getById(appUserId);
    if (!appUser) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }
    return await userRepository.updateAppUser(appUserId, data);
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    return await userRepository.getAllUsers();
  }
}

export const userService = new UserService();
