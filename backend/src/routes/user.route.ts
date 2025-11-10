import { requireAuth } from "../middleware/auth";
import { userService } from "../services/user.service";
import { createAppHono } from "../types/hono";

const users = createAppHono();

// GET /users/me - Get current user details
users.get("/me", requireAuth, async (c) => {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "User not found" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

export default users;
