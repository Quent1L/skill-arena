import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { tournamentService } from "../services/tournament.service";
import {
  createTournamentSchema,
  updateTournamentSchema,
  changeTournamentStatusSchema,
  listTournamentsQuerySchema,
} from "../schemas/tournament.schema";
import type { Context } from "hono";
import { auth } from "../config/auth";

type AppContext = Context<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    appUserId: string | null;
  };
}>;

const tournaments = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
    appUserId: string;
  };
}>();

// Middleware to require authentication and set appUserId
async function requireAuth(c: AppContext, next: () => Promise<void>) {
  const betterAuthUser = c.get("user");

  if (!betterAuthUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get or create the app_user via service
  const appUserId = await tournamentService.getOrCreateAppUser(
    betterAuthUser.id,
    betterAuthUser.name || betterAuthUser.email
  );

  c.set("appUserId", appUserId);
  await next();
}

// POST /tournaments - Create new tournament
tournaments.post(
  "/",
  requireAuth,
  zValidator("json", createTournamentSchema),
  async (c) => {
    try {
      const appUserId = c.get("appUserId");
      const data = c.req.valid("json");

      const tournament = await tournamentService.createTournament({
        ...data,
        createdBy: appUserId,
      });

      return c.json(tournament, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  }
);

// GET /tournaments - List all tournaments (with filters)
tournaments.get(
  "/",
  zValidator("query", listTournamentsQuerySchema),
  async (c) => {
    try {
      const filters = c.req.valid("query");
      const tournamentsList = await tournamentService.listTournaments(filters);
      return c.json(tournamentsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  }
);

// GET /tournaments/:id - Get single tournament
tournaments.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const tournament = await tournamentService.getTournamentById(id);
    return c.json(tournament);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Tournament not found" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

// PATCH /tournaments/:id - Update tournament
tournaments.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateTournamentSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const appUserId = c.get("appUserId");
      const data = c.req.valid("json");

      const tournament = await tournamentService.updateTournament(
        id,
        appUserId,
        data
      );

      return c.json(tournament);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = message.includes("permission") ? 403 : 400;
      return c.json({ error: message }, status);
    }
  }
);

// PATCH /tournaments/:id/status - Change tournament status
tournaments.patch(
  "/:id/status",
  requireAuth,
  zValidator("json", changeTournamentStatusSchema),
  async (c) => {
    try {
      const id = c.req.param("id");
      const appUserId = c.get("appUserId");
      const { status } = c.req.valid("json");

      const tournament = await tournamentService.changeTournamentStatus(
        id,
        appUserId,
        status
      );

      return c.json(tournament);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = message.includes("permission") ? 403 : 400;
      return c.json({ error: message }, status);
    }
  }
);

// DELETE /tournaments/:id - Delete tournament
tournaments.delete("/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");

    const result = await tournamentService.deleteTournament(id, appUserId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("permission") ? 403 : 400;
    return c.json({ error: message }, status);
  }
});

export default tournaments;
