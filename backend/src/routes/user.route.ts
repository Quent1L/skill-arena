import { requireAuth } from "../middleware/auth";
import { userService } from "../services/user.service";
import { createAppHono } from "../types/hono";

const users = createAppHono();

// GET /users/me - Get current user details
users.get("/me", requireAuth, async (c) => {
  const appUserId = c.get("appUserId");
  const betterAuthUser = c.get("user");

  // Get app user details
  const appUser = await userService.getAppUserById(appUserId);

  return c.json({
    id: appUser.id,
    externalId: appUser.externalId,
    displayName: appUser.displayName,
    role: appUser.role,
    createdAt: appUser.createdAt,
    updatedAt: appUser.updatedAt,
    // Include Better Auth user info as well
    betterAuth: {
      id: betterAuthUser?.id,
      email: betterAuthUser?.email,
      name: betterAuthUser?.name,
      image: betterAuthUser?.image,
      emailVerified: betterAuthUser?.emailVerified,
      createdAt: betterAuthUser?.createdAt,
      updatedAt: betterAuthUser?.updatedAt,
    },
  });
});

export default users;
