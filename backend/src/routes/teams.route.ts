import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { teamService } from "../services/team.service";
import { tournamentService } from "../services/tournament.service";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";
import { createTeamSchema } from "@skill-arena/shared/types/index";

const teams = createAppHono();

// GET /tournaments/:id/teams - List teams (public)
teams.get("/:id/teams", async (c) => {
  const tournamentId = c.req.param("id")!;
  const result = await teamService.listTeams(tournamentId);
  return c.json(result);
});

// POST /tournaments/:id/teams - Create a team (auth required)
teams.post(
  "/:id/teams",
  requireAuth,
  zValidator("json", createTeamSchema),
  async (c) => {
    const tournamentId = c.req.param("id")!;
    const { name } = c.req.valid("json");
    const appUserId = c.get("appUserId")!;
    const isAdmin = await tournamentService.canManageTournament(tournamentId, appUserId);
    const team = await teamService.createTeam(tournamentId, name, appUserId, isAdmin);
    return c.json(team, 201);
  },
);

// POST /tournaments/:id/teams/:teamId/join - Join a team (auth required)
teams.post(
  "/:id/teams/:teamId/join",
  requireAuth,
  zValidator("json", z.object({ userId: z.string().uuid().optional() })),
  async (c) => {
    const tournamentId = c.req.param("id")!;
    const teamId = c.req.param("teamId")!;
    const { userId } = c.req.valid("json");
    const appUserId = c.get("appUserId")!;
    const isAdmin = await tournamentService.canManageTournament(tournamentId, appUserId);
    const targetUserId = userId ?? appUserId;
    const team = await teamService.joinTeam(teamId, tournamentId, targetUserId, appUserId, isAdmin);
    return c.json(team);
  },
);

// DELETE /tournaments/:id/teams/:teamId/leave - Leave a team (auth required)
teams.delete(
  "/:id/teams/:teamId/leave",
  requireAuth,
  async (c) => {
    const tournamentId = c.req.param("id")!;
    const teamId = c.req.param("teamId")!;
    const appUserId = c.get("appUserId")!;
    const userId = c.req.query("userId") ?? appUserId;
    const isAdmin = await tournamentService.canManageTournament(tournamentId, appUserId);
    await teamService.leaveTeam(teamId, userId, appUserId, isAdmin);
    return c.json({ success: true });
  },
);

// DELETE /tournaments/:id/teams/:teamId - Delete a team (auth required, admin/creator)
teams.delete(
  "/:id/teams/:teamId",
  requireAuth,
  async (c) => {
    const tournamentId = c.req.param("id")!;
    const teamId = c.req.param("teamId")!;
    const appUserId = c.get("appUserId")!;
    const isAdmin = await tournamentService.canManageTournament(tournamentId, appUserId);
    await teamService.deleteTeam(teamId, appUserId, isAdmin);
    return c.json({ success: true });
  },
);

export default teams;
