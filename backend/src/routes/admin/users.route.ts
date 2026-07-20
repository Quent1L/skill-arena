import { zValidator } from "@hono/zod-validator";
import { createAppHono } from "../../types/hono";
import { requireAuth } from "../../middleware/auth";
import { requireSuperAdmin } from "../../middleware/require-role";
import { userService } from "../../services/user.service";
import {
  adminAddOrganizationSchema,
  adminArchiveUserSchema,
  adminRestoreUserSchema,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
} from "@skol-arena/shared";

const adminUsers = createAppHono();

adminUsers.use("*", requireAuth, requireSuperAdmin);

adminUsers.get("/", zValidator("query", adminUserListQuerySchema), async (c) => {
  const filters = c.req.valid("query");
  return c.json(await userService.listUsersAdmin(filters));
});

// Registered before /:id so the static segment wins.
adminUsers.get("/stats", async (c) => {
  return c.json(await userService.getAdminStats());
});

adminUsers.get("/:id", async (c) => {
  return c.json(await userService.getUserAdminDetail(c.req.param("id")));
});

adminUsers.patch("/:id", zValidator("json", adminUpdateUserSchema), async (c) => {
  const actorId = c.get("appUserId");
  const updated = await userService.adminUpdateUser(actorId, c.req.param("id"), c.req.valid("json"));
  return c.json(updated);
});

adminUsers.post("/:id/reset-password", async (c) => {
  await userService.sendPasswordReset(c.req.param("id"));
  return c.json({ success: true });
});

adminUsers.post("/:id/deactivate", async (c) => {
  const actorId = c.get("appUserId");
  return c.json(await userService.deactivateUser(actorId, c.req.param("id")));
});

adminUsers.post("/:id/reactivate", async (c) => {
  return c.json(await userService.reactivateUser(c.req.param("id")));
});

adminUsers.post("/:id/archive", zValidator("json", adminArchiveUserSchema), async (c) => {
  const actorId = c.get("appUserId");
  return c.json(await userService.archiveUser(actorId, c.req.param("id"), c.req.valid("json")));
});

adminUsers.post("/:id/restore", zValidator("json", adminRestoreUserSchema), async (c) => {
  const actorId = c.get("appUserId");
  return c.json(
    await userService.restoreArchivedUser(actorId, c.req.param("id"), c.req.valid("json")),
  );
});

adminUsers.delete("/:id", async (c) => {
  const actorId = c.get("appUserId");
  await userService.deleteUserPermanently(actorId, c.req.param("id"));
  return c.json({ success: true });
});

adminUsers.post(
  "/:id/organizations",
  zValidator("json", adminAddOrganizationSchema),
  async (c) => {
    const { organizationId } = c.req.valid("json");
    await userService.addUserToOrganization(c.req.param("id"), organizationId);
    return c.json({ success: true }, 201);
  },
);

adminUsers.delete("/:id/organizations/:orgId", async (c) => {
  await userService.removeUserFromOrganization(c.req.param("id"), c.req.param("orgId"));
  return c.json({ success: true });
});

export default adminUsers;
