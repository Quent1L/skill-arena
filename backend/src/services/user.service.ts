import { userRepository } from "../repository/user.repository";
import { invitationRepository } from "../repository/invitation.repository";
import { organizationService } from "./organization.service";
import { auth } from "../config/auth";
import {
  ConflictError,
  ErrorCode,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../types/errors";
import { logger } from "../utils/logger";
import { withStrictEmailDelivery } from "../utils/email-delivery-context";
import type {
  AdminArchiveUserInput,
  AdminRestoreUserInput,
  AdminUpdateUserInput,
  AdminUserDetail,
  AdminUserListQuery,
  UpdateProfileInput,
  PlayerProfile,
} from "@skol-arena/shared";

/**
 * Absolute origin serving the Vue app. A relative redirectTo would be resolved
 * by Better Auth against the backend origin, which has no /reset-password route
 * in development (the frontend runs on its own dev server).
 * In production the backend serves the built frontend, so its own URL is right.
 */
function resolveFrontendUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.NODE_ENV === "production") {
    return process.env.BETTER_AUTH_URL || process.env.BASE_URL || "";
  }
  return "http://localhost:5173";
}

export class UserService {
  /**
   * Get or create app_user from BetterAuth external ID
   */
  async getOrCreateAppUser(
    betterAuthUserId: string,
    displayName: string
  ): Promise<string> {
    let appUser = await userRepository.getByExternalId(betterAuthUserId);

    // If the appUser already exists, return it
    if (appUser) {
      if (appUser.deactivatedAt) {
        throw new ForbiddenError(ErrorCode.USER_DEACTIVATED);
      }
      return appUser.id;
    }

    // Otherwise, verify an invitation code has been consumed before creating the appUser
    const hasValidInvitation = await invitationRepository.hasUserUsedCode(betterAuthUserId);

    if (!hasValidInvitation) {
      throw new UnauthorizedError(
        ErrorCode.INVITATION_CODE_REQUIRED,
        { betterAuthUserId }
      );
    }

    // Valid invitation code, create the appUser
    appUser = await userRepository.createAppUser({
      externalId: betterAuthUserId,
      displayName: displayName,
      shortName: displayName.substring(0, 8).toUpperCase(),
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
   * Search users by name (authenticated). Returns lightweight player profiles.
   */
  async searchUsers(query: string, limit = 10): Promise<PlayerProfile[]> {
    const users = await userRepository.searchByName(query, limit);
    return users.map((u) => ({ id: u.id, displayName: u.displayName, shortName: u.shortName }));
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    return await userRepository.getAllUsers();
  }

  // ============================================
  // Admin user management (super_admin only)
  // ============================================

  async listUsersAdmin(filters: AdminUserListQuery) {
    return await userRepository.listUsersAdmin(filters);
  }

  async getAdminStats() {
    return await userRepository.getAdminStats();
  }

  async getUserAdminDetail(id: string): Promise<AdminUserDetail> {
    const detail = await userRepository.getUserAdminDetail(id);
    if (!detail) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }
    return detail;
  }

  /**
   * Loads the target user and rejects the operations an admin must not perform
   * on themselves, which is how a super admin would lock everyone out.
   */
  private async assertCanAdminister(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new ForbiddenError(ErrorCode.CANNOT_MODIFY_SELF);
    }
    const target = await userRepository.getById(targetId);
    if (!target) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }
    return target;
  }

  /**
   * Refuses to leave the instance without an active super admin.
   */
  private async assertNotLastSuperAdmin(targetRole: string) {
    if (targetRole !== "super_admin") return;
    const remaining = await userRepository.countByRole("super_admin");
    if (remaining <= 1) {
      throw new ForbiddenError(ErrorCode.LAST_SUPER_ADMIN);
    }
  }

  async adminUpdateUser(actorId: string, targetId: string, input: AdminUpdateUserInput) {
    const target = await this.assertCanAdminister(actorId, targetId);

    if (input.role && input.role !== target.role) {
      await this.assertNotLastSuperAdmin(target.role);
    }

    if (input.email) {
      // An archived user has no Better Auth identity left to carry an email.
      if (!target.externalId) {
        throw new ConflictError(ErrorCode.USER_IS_ARCHIVED);
      }
      if (await userRepository.isEmailTaken(input.email, target.externalId)) {
        throw new ConflictError(ErrorCode.EMAIL_ALREADY_EXISTS);
      }
      await userRepository.updateExternalUserEmail(target.externalId, input.email);
    }

    const { displayName, shortName, role } = input;
    if (displayName !== undefined || shortName !== undefined || role !== undefined) {
      await userRepository.updateAppUser(targetId, { displayName, shortName, role });
    }

    return await this.getUserAdminDetail(targetId);
  }

  /**
   * Triggers the standard Better Auth reset flow, which mails the user a link.
   */
  async sendPasswordReset(targetId: string): Promise<void> {
    const detail = await this.getUserAdminDetail(targetId);
    if (!detail.email) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    // emailAndPassword is attached to the config after the typed literal, so the
    // endpoint exists at runtime but is missing from the inferred api type.
    const api = auth.api as unknown as {
      requestPasswordReset: (opts: {
        body: { email: string; redirectTo: string };
      }) => Promise<unknown>;
    };

    try {
      await withStrictEmailDelivery(() =>
        api.requestPasswordReset({
          body: {
            email: detail.email as string,
            redirectTo: `${resolveFrontendUrl()}/reset-password`,
          },
        })
      );
    } catch (error) {
      // Covers SMTP failures reported by the sendResetPassword hook as well as any
      // Better Auth error: the admin must not be told the mail left when it did not.
      logger.error({ err: error, targetId }, "Admin password reset failed");
      throw new InternalServerError(ErrorCode.EMAIL_SEND_FAILED);
    }
  }

  async deactivateUser(actorId: string, targetId: string) {
    const target = await this.assertCanAdminister(actorId, targetId);
    await this.assertNotLastSuperAdmin(target.role);

    await userRepository.updateAppUser(targetId, {
      deactivatedAt: new Date(),
      deactivatedBy: actorId,
    });
    if (target.externalId) {
      await userRepository.revokeSessions(target.externalId);
    }

    return await this.getUserAdminDetail(targetId);
  }

  async reactivateUser(targetId: string) {
    const target = await userRepository.getById(targetId);
    if (!target) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    await userRepository.updateAppUser(targetId, {
      deactivatedAt: null,
      deactivatedBy: null,
    });

    return await this.getUserAdminDetail(targetId);
  }

  /**
   * Hard delete. Fails with the offending resources listed when the user owns
   * content protected by a restrict foreign key.
   */
  async deleteUserPermanently(actorId: string, targetId: string): Promise<void> {
    const target = await this.assertCanAdminister(actorId, targetId);
    await this.assertNotLastSuperAdmin(target.role);

    const blockers = await userRepository.getDeletionBlockers(targetId);
    if (blockers.length > 0) {
      throw new ConflictError(ErrorCode.USER_HAS_OWNED_CONTENT, { blockers });
    }

    await userRepository.deleteUserPermanently(targetId, target.externalId);
  }

  /**
   * Terminal alternative to deletion: destroys the Better Auth identity and
   * anonymises the profile, keeping the app_users row so every match, standing
   * and MMR entry that references it survives.
   */
  async archiveUser(actorId: string, targetId: string, input: AdminArchiveUserInput = {}) {
    const target = await this.assertCanAdminister(actorId, targetId);
    await this.assertNotLastSuperAdmin(target.role);

    if (target.archivedAt) {
      throw new ConflictError(ErrorCode.USER_ALREADY_ARCHIVED);
    }

    const label = (await userRepository.countArchived()) + 1;
    await userRepository.archiveUser(
      targetId,
      target.externalId,
      actorId,
      input.displayName ?? `Archive ${label}`,
      input.shortName ?? `ARCH${label}`.slice(0, 8),
    );

    return await this.getUserAdminDetail(targetId);
  }

  /**
   * A player who left and came back signs up again, which creates a fresh empty
   * profile. Restoring moves that new identity onto their archived profile so the
   * whole history (matches, standings, MMR, badges) becomes theirs again.
   */
  async restoreArchivedUser(actorId: string, archivedId: string, input: AdminRestoreUserInput) {
    const archived = await userRepository.getById(archivedId);
    if (!archived) throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    if (!archived.archivedAt) throw new ConflictError(ErrorCode.USER_NOT_ARCHIVED);

    const source = await this.assertCanAdminister(actorId, input.sourceUserId);
    if (source.archivedAt) throw new ConflictError(ErrorCode.USER_ALREADY_ARCHIVED);
    if (!source.externalId) throw new ConflictError(ErrorCode.USER_IS_ARCHIVED);

    // Merging two populated histories is out of scope, so the source must be empty.
    const blockers = await userRepository.getDeletionBlockers(source.id);
    if (blockers.length > 0) {
      throw new ConflictError(ErrorCode.USER_HAS_OWNED_CONTENT, { blockers });
    }

    await userRepository.restoreArchivedUser(
      archivedId,
      source.id,
      source.externalId,
      source.displayName,
      source.shortName,
    );

    return await this.getUserAdminDetail(archivedId);
  }

  async addUserToOrganization(targetId: string, organizationId: string): Promise<void> {
    const target = await userRepository.getById(targetId);
    if (!target) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }
    await organizationService.addMemberDirect(organizationId, targetId);
  }

  async removeUserFromOrganization(targetId: string, organizationId: string): Promise<void> {
    await organizationService.removeMember(organizationId, targetId);
  }
}

export const userService = new UserService();
