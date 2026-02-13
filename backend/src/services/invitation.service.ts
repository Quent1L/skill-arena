import { randomBytes } from "crypto";
import { invitationRepository } from "../repository/invitation.repository";
import {
  BadRequestError,
  ErrorCode,
  NotFoundError,
  ConflictError,
} from "../types/errors";

export class InvitationService {
  async generateCode(data: {
    createdBy: string;
    maxUses?: number;
    expiresInDays?: number;
    notes?: string;
  }) {
    const code = randomBytes(16).toString("hex");
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return await invitationRepository.create({
      code,
      createdBy: data.createdBy,
      maxUses: data.maxUses ?? 1,
      expiresAt,
      notes: data.notes ?? null,
    });
  }

  async validateCode(code: string) {
    if (!code || code.trim().length === 0) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_REQUIRED);
    }

    const invitation = await invitationRepository.findByCode(code);
    if (!invitation) {
      throw new NotFoundError(ErrorCode.INVITATION_CODE_INVALID);
    }
    if (!invitation.isActive) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_INACTIVE);
    }
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_EXPIRED);
    }
    if (invitation.usedCount >= invitation.maxUses) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_EXHAUSTED);
    }

    return {
      valid: true,
      remainingUses: invitation.maxUses - invitation.usedCount,
    };
  }

  async consumeCode(code: string, userId: string, email: string, ipAddress?: string) {
    const invitation = await invitationRepository.findByCode(code);
    if (!invitation) {
      throw new NotFoundError(ErrorCode.INVITATION_CODE_INVALID);
    }
    if (!invitation.isActive) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_INACTIVE);
    }
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_EXPIRED);
    }
    if (invitation.usedCount >= invitation.maxUses) {
      throw new BadRequestError(ErrorCode.INVITATION_CODE_EXHAUSTED);
    }

    const hasUsed = await invitationRepository.hasUserUsedCode(userId);
    if (hasUsed) {
      throw new ConflictError(ErrorCode.INVITATION_CODE_ALREADY_USED);
    }

    await invitationRepository.incrementUsage(invitation.id);
    await invitationRepository.recordUsage({
      codeId: invitation.id,
      userId,
      email,
      ipAddress: ipAddress ?? null,
    });

    return true;
  }

  async consumeCodeAndCreateAppUser(
    code: string,
    betterAuthUserId: string,
    email: string,
    displayName: string,
    ipAddress?: string
  ) {
    await this.consumeCode(code, betterAuthUserId, email, ipAddress);

    const { userRepository } = await import("../repository/user.repository");
    const appUser = await userRepository.createAppUser({
      externalId: betterAuthUserId,
      displayName: displayName,
      role: "player",
    });

    return appUser;
  }

  async getAllCodes() {
    return await invitationRepository.getAll();
  }

  async deactivateCode(codeId: string) {
    const code = await invitationRepository.findByCode(codeId);
    if (!code) {
      throw new NotFoundError(ErrorCode.INVITATION_CODE_NOT_FOUND);
    }
    return await invitationRepository.deactivate(codeId);
  }
}

export const invitationService = new InvitationService();
