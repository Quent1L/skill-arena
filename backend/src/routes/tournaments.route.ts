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

// POST /tournaments/:id/participants - Join tournament
tournaments.post(
  "/:id/participants",
  requireAuth,
  zValidator("json", joinTournamentSchema),
  async (c) => {
    try {
      const tournamentId = c.req.param("id");
      const appUserId = c.get("appUserId");

      // Validation de l'UUID du tournoi
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tournamentId)) {
        return c.json({ error: "ID de tournoi invalide" }, 400);
      }

      const participation = await tournamentService.joinTournament(appUserId, {
        tournamentId,
      });

      return c.json(participation, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      let status = 400;

      if (message.includes("non trouvé")) {
        status = 404;
      } else if (
        message.includes("déjà inscrit") ||
        message.includes("pas ouvert")
      ) {
        status = 409; // Conflict
      }

      return c.json({ error: message }, status);
    }
  }
);

// DELETE /tournaments/:id/participants - Leave tournament
tournaments.delete("/:id/participants", requireAuth, async (c) => {
  try {
    const tournamentId = c.req.param("id");
    const appUserId = c.get("appUserId");

    // Validation de l'UUID du tournoi
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tournamentId)) {
      return c.json({ error: "ID de tournoi invalide" }, 400);
    }

    const result = await tournamentService.leaveTournament(appUserId, tournamentId);

    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    let status = 400;

    if (message.includes("non trouvé")) {
      status = 404;
    } else if (
      message.includes("pas inscrit") ||
      message.includes("Impossible")
    ) {
      status = 409;
    }

    return c.json({ error: message }, status);
  }
});

// GET /tournaments/:id/participants - Get tournament participants
tournaments.get("/:id/participants", async (c) => {
  try {
    const tournamentId = c.req.param("id");

    // Validation de l'UUID du tournoi
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tournamentId)) {
      return c.json({ error: "ID de tournoi invalide" }, 400);
    }

    const participants = await tournamentService.getTournamentParticipants(tournamentId);

    return c.json(participants);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("invalide") ? 400 : 500;
    return c.json({ error: message }, status);
  }
});

export default tournaments;
