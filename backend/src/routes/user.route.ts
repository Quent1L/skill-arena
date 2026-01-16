import { requireAuth } from "../middleware/auth";
import { userService } from "../services/user.service";
import { createAppHono } from "../types/hono";
import { userRepository } from "../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../types/errors";

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

// GET /users - Get all users (admin only)
users.get("/", requireAuth, async (c) => {
  const appUserId = c.get("appUserId");

  const currentUser = await userRepository.getById(appUserId);
  if (
    !currentUser ||
    (currentUser.role !== "super_admin" &&
      currentUser.role !== "tournament_admin")
  ) {
    throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
  }

  const allUsers = await userService.getAllUsers();

  const usersResponse = allUsers.map((user) => ({
    id: user.id,
    externalId: user.externalId,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    betterAuth: {
      id: user.externalUser?.id,
      email: user.externalUser?.email,
      name: user.externalUser?.name,
      image: user.externalUser?.image,
      emailVerified: user.externalUser?.emailVerified,
      createdAt: user.externalUser?.createdAt,
      updatedAt: user.externalUser?.updatedAt,
    },
  }));

  return c.json(usersResponse);
});

export default users;
