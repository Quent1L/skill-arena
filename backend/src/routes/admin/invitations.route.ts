import { zValidator } from "@hono/zod-validator";
import { createAppHono } from "../../types/hono";
import { requireAuth } from "../../middleware/auth";
import { invitationService } from "../../services/invitation.service";
import { userRepository } from "../../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../../types/errors";
import { generateInvitationCodeSchema } from "@skill-arena/shared/schemas/invitation.schema";

const adminInvitations = createAppHono();

const requireSuperAdmin = async (c: any, next: any) => {
  const appUserId = c.get("appUserId");
  const currentUser = await userRepository.getById(appUserId);

  if (!currentUser || currentUser.role !== "super_admin") {
    throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
  }

  await next();
};

adminInvitations.post(
  "/generate",
  requireAuth,
  requireSuperAdmin,
  zValidator("json", generateInvitationCodeSchema),
  async (c) => {
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");
    const code = await invitationService.generateCode({
      createdBy: appUserId,
      ...data,
    });
    return c.json(code, 201);
  }
);

adminInvitations.get("/", requireAuth, requireSuperAdmin, async (c) => {
  const codes = await invitationService.getAllCodes();
  return c.json(codes);
});

adminInvitations.patch(
  "/:id/deactivate",
  requireAuth,
  requireSuperAdmin,
  async (c) => {
    const codeId = c.req.param("id");
    const updated = await invitationService.deactivateCode(codeId);
    return c.json(updated);
  }
);

export default adminInvitations;
