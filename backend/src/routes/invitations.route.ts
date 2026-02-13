import { zValidator } from "@hono/zod-validator";
import { createAppHono } from "../types/hono";
import { invitationService } from "../services/invitation.service";
import {
  validateInvitationCodeSchema,
  consumeInvitationCodeSchema
} from "@skill-arena/shared/schemas/invitation.schema";

const invitations = createAppHono();

invitations.post(
  "/validate",
  zValidator("json", validateInvitationCodeSchema),
  async (c) => {
    const { code } = c.req.valid("json");
    const result = await invitationService.validateCode(code);
    return c.json(result);
  }
);

invitations.post(
  "/consume",
  zValidator("json", consumeInvitationCodeSchema),
  async (c) => {
    const betterAuthUser = c.get("user");

    if (!betterAuthUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { code } = c.req.valid("json");
    const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");

    const appUser = await invitationService.consumeCodeAndCreateAppUser(
      code,
      betterAuthUser.id,
      betterAuthUser.email,
      betterAuthUser.name || betterAuthUser.email,
      ipAddress
    );

    return c.json({
      success: true,
      appUserId: appUser.id
    });
  }
);

export default invitations;
