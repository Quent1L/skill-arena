import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { MiddlewareHandler } from "hono";
import { createAppHono, type AppVariables } from "../../types/hono";
import { requireAuth } from "../../middleware/auth";
import { organizationService } from "../../services/organization.service";
import { userRepository } from "../../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../../types/errors";

const adminOrganizations = createAppHono();

const requireSuperAdmin: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const appUserId = c.get("appUserId");
  const currentUser = await userRepository.getById(appUserId);
  if (!currentUser || currentUser.role !== "super_admin") {
    throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
  }
  await next();
};

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
});

const addMemberSchema = z.object({ userId: z.string().uuid() });
const renameOrganizationSchema = z.object({ name: z.string().min(1).max(100) });

adminOrganizations.get("/", requireAuth, requireSuperAdmin, async (c) => {
  const orgs = await organizationService.getAllOrganizations();
  return c.json(orgs);
});

adminOrganizations.post(
  "/",
  requireAuth,
  requireSuperAdmin,
  zValidator("json", createOrganizationSchema),
  async (c) => {
    const appUserId = c.get("appUserId");
    const { name } = c.req.valid("json");
    const org = await organizationService.createOrganization(name, appUserId);
    return c.json(org, 201);
  }
);

adminOrganizations.get("/:id/members", requireAuth, requireSuperAdmin, async (c) => {
  const members = await organizationService.getMembers(c.req.param("id"));
  return c.json(members);
});

adminOrganizations.post(
  "/:id/members",
  requireAuth,
  requireSuperAdmin,
  zValidator("json", addMemberSchema),
  async (c) => {
    const { userId } = c.req.valid("json");
    await organizationService.addMemberDirect(c.req.param("id"), userId);
    return c.json({ success: true }, 201);
  },
);

adminOrganizations.delete("/:id/members/:userId", requireAuth, requireSuperAdmin, async (c) => {
  await organizationService.removeMember(c.req.param("id"), c.req.param("userId"));
  return c.json({ success: true });
});

adminOrganizations.patch(
  "/:id",
  requireAuth,
  requireSuperAdmin,
  zValidator("json", renameOrganizationSchema),
  async (c) => {
    const { name } = c.req.valid("json");
    const updated = await organizationService.renameOrganization(c.req.param("id"), name);
    return c.json(updated);
  },
);

export default adminOrganizations;
