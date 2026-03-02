import { requireAuth } from "../middleware/auth";
import { userService } from "../services/user.service";
import { createAppHono } from "../types/hono";
import { userRepository } from "../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../types/errors";
import { zValidator } from "@hono/zod-validator";
import { updateProfileSchema, playerStatsFiltersSchema } from "@skill-arena/shared";
import { playerStatsService } from "../services/player-stats.service";

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
    shortName: appUser.shortName,
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

// PATCH /users/me - Update current user profile
users.patch("/me", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
  const appUserId = c.get("appUserId");
  const data = c.req.valid("json");
  const updated = await userService.updateProfile(appUserId, data);
  return c.json({
    id: updated.id,
    externalId: updated.externalId,
    displayName: updated.displayName,
    shortName: updated.shortName,
    role: updated.role,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
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
    shortName: user.shortName,
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

// GET /users/:id - Public player profile
users.get("/:id", async (c) => {
  const id = c.req.param("id");
  const player = await playerStatsService.getPlayerProfile(id);
  return c.json(player);
});

// GET /users/:id/tournaments - Tournaments list for filter dropdown
users.get("/:id/tournaments", async (c) => {
  const id = c.req.param("id");
  const tournaments = await playerStatsService.getPlayerTournaments(id);
  return c.json({ tournaments });
});

// GET /users/:id/stats - Player stats (filterable)
users.get("/:id/stats", zValidator("query", playerStatsFiltersSchema), async (c) => {
  const id = c.req.param("id");
  const filters = c.req.valid("query");
  const result = await playerStatsService.getPlayerStats(id, filters);
  return c.json(result);
});

export default users;
