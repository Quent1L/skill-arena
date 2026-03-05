import { zValidator } from "@hono/zod-validator";
import { tournamentService } from "../services/tournament.service";
import { standingsService } from "../services/standings.service";
import { bracketService } from "../services/bracket.service";
import {
  createTournamentRequestSchema,
  updateTournamentSchema,
  changeTournamentStatusSchema,
  listTournamentsQuerySchema,
  joinTournamentSchema,
  adminAddParticipantSchema,
} from "../schemas/tournament.schema";
import { generateBracketSchema } from "@skill-arena/shared";
import { requireAuth } from "../middleware/auth";
import { userRepository } from "../repository/user.repository";
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
    const betterAuthUser = c.get("user");

    let isAdmin = false;
    if (betterAuthUser) {
      const appUser = await userRepository.getByExternalId(betterAuthUser.id);
      isAdmin = appUser?.role === "super_admin";
    }

    const tournamentsList = await tournamentService.listTournaments(filters, isAdmin);
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

// POST /tournaments/:id/participants/add - Admin adds a participant
tournaments.post(
  "/:id/participants/add",
  requireAuth,
  zValidator("json", adminAddParticipantSchema),
  async (c) => {
    const tournamentId = c.req.param("id");
    const appUserId = c.get("appUserId");
    const { userId: targetUserId } = c.req.valid("json");

    const participation = await tournamentService.adminAddParticipant(
      appUserId,
      tournamentId,
      targetUserId
    );

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

// GET /tournaments/:id/standings/official - Get official standings (finalized matches only)
tournaments.get("/:id/standings/official", async (c) => {
  const tournamentId = c.req.param("id");

  // Validation de l'UUID du tournoi
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    return c.json({ error: "ID de tournoi invalide" }, 400);
  }

  const standings = await standingsService.getOfficialStandings(tournamentId);
  return c.json(standings);
});

// GET /tournaments/:id/standings/provisional - Get provisional standings (reported + finalized matches)
tournaments.get("/:id/standings/provisional", async (c) => {
  const tournamentId = c.req.param("id");

  // Validation de l'UUID du tournoi
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    return c.json({ error: "ID de tournoi invalide" }, 400);
  }

  const standings = await standingsService.getProvisionalStandings(tournamentId);
  return c.json(standings);
});

// POST /tournaments/:id/recalculate-points - Admin: recalculate all match points
tournaments.post("/:id/recalculate-points", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const appUserId = c.get("appUserId");
  const result = await standingsService.recalculatePoints(tournamentId, appUserId);
  return c.json(result);
});

// ============================================
// Bracket Routes
// ============================================

// POST /tournaments/:id/bracket - Generate or regenerate bracket
tournaments.post(
  "/:id/bracket",
  requireAuth,
  zValidator("json", generateBracketSchema),
  async (c) => {
    const tournamentId = c.req.param("id");
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const bracket = await bracketService.generateBracket(
      tournamentId,
      data,
      appUserId
    );

    return c.json(bracket, 201);
  }
);

// GET /tournaments/:id/bracket - Get bracket data
tournaments.get("/:id/bracket", async (c) => {
  const tournamentId = c.req.param("id");
  const bracket = await bracketService.getBracketData(tournamentId);

  if (!bracket) {
    return c.json({ error: "No bracket found for this tournament" }, 404);
  }

  return c.json(bracket);
});

// GET /tournaments/:id/bracket/can-generate - Check if bracket can be generated
tournaments.get("/:id/bracket/can-generate", async (c) => {
  const tournamentId = c.req.param("id");
  const result = await bracketService.canGenerateBracket(tournamentId);
  return c.json(result);
});

// DELETE /tournaments/:id/bracket - Delete bracket and all matches
tournaments.delete("/:id/bracket", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const appUserId = c.get("appUserId");

  await bracketService.deleteBracket(tournamentId, appUserId);

  return c.json({ success: true, message: "Bracket deleted successfully" });
});

export default tournaments;
