import { zValidator } from "@hono/zod-validator";
import { tournamentService } from "../services/tournament.service";
import {
  createTournamentRequestSchema,
  updateTournamentSchema,
  changeTournamentStatusSchema,
  listTournamentsQuerySchema,
  joinTournamentSchema,
} from "../schemas/tournament.schema";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const tournaments = createAppHono();

// POST /tournaments - Create new tournament
tournaments.post(
  "/",
  requireAuth,
  zValidator("json", createTournamentRequestSchema),
  async (c) => {
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const tournament = await tournamentService.createTournament({
      ...data,
      createdBy: appUserId,
    });

    return c.json(tournament, 201);
  }
);

// GET /tournaments - List all tournaments (with filters)
tournaments.get(
  "/",
  zValidator("query", listTournamentsQuerySchema),
  async (c) => {
    const filters = c.req.valid("query");
    const tournamentsList = await tournamentService.listTournaments(filters);
    return c.json(tournamentsList);
  }
);

// GET /tournaments/:id - Get single tournament
tournaments.get("/:id", async (c) => {
  const id = c.req.param("id");
  const tournament = await tournamentService.getTournamentById(id);
  return c.json(tournament);
});

// PATCH /tournaments/:id - Update tournament
tournaments.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateTournamentSchema),
  async (c) => {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const tournament = await tournamentService.updateTournament(
      id,
      appUserId,
      data
    );

    return c.json(tournament);
  }
);

// PATCH /tournaments/:id/status - Change tournament status
tournaments.patch(
  "/:id/status",
  requireAuth,
  zValidator("json", changeTournamentStatusSchema),
  async (c) => {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");
    const { status } = c.req.valid("json");

    const tournament = await tournamentService.changeTournamentStatus(
      id,
      appUserId,
      status
    );

    return c.json(tournament);
  }
);

// DELETE /tournaments/:id - Delete tournament
tournaments.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const appUserId = c.get("appUserId");

  const result = await tournamentService.deleteTournament(id, appUserId);
  return c.json(result);
});

// POST /tournaments/:id/participants - Join tournament
tournaments.post(
  "/:id/participants",
  requireAuth,
  zValidator("json", joinTournamentSchema),
  async (c) => {
    const tournamentId = c.req.param("id");
    const appUserId = c.get("appUserId");

    // Validation de l'UUID du tournoi
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tournamentId)) {
      return c.json({ error: "ID de tournoi invalide" }, 400);
    }

    const participation = await tournamentService.joinTournament(appUserId, {
      tournamentId,
    });

    return c.json(participation, 201);
  }
);

// DELETE /tournaments/:id/participants - Leave tournament
tournaments.delete("/:id/participants", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const appUserId = c.get("appUserId");

  // Validation de l'UUID du tournoi
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    return c.json({ error: "ID de tournoi invalide" }, 400);
  }

  const result = await tournamentService.leaveTournament(
    appUserId,
    tournamentId
  );

  return c.json(result);
});

// GET /tournaments/:id/participants - Get tournament participants
tournaments.get("/:id/participants", async (c) => {
  const tournamentId = c.req.param("id");

  // Validation de l'UUID du tournoi
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    return c.json({ error: "ID de tournoi invalide" }, 400);
  }

  const participants = await tournamentService.getTournamentParticipants(
    tournamentId
  );

  return c.json(participants);
});

export default tournaments;
