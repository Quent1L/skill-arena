import { zValidator } from "@hono/zod-validator";
import { createAppHono } from "../../types/hono";
import { requireAuth } from "../../middleware/auth";
import { requireSuperAdmin } from "../../middleware/require-role";
import { invitationService } from "../../services/invitation.service";
import { generateInvitationCodeSchema } from "@skol-arena/shared/schemas/invitation.schema";

const adminInvitations = createAppHono();

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
    const codeId = c.req.param("id")!;
    const updated = await invitationService.deactivateCode(codeId);
    return c.json(updated);
  }
);

export default adminInvitations;
