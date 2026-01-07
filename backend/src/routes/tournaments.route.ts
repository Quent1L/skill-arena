import { zValidator } from "@hono/zod-validator";
import { tournamentService } from "../services/tournament.service";
import { standingsService } from "../services/standings.service";
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

// POST /tournaments/:id/participants/add - Add participant (admin only)
tournaments.post("/:id/participants/add", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const appUserId = c.get("appUserId");
  const { userId } = await c.req.json();

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  const participation = await tournamentService.addParticipant(
    appUserId,
    tournamentId,
    userId
  );

  return c.json(participation, 201);
});

// DELETE /tournaments/:id/participants/:userId - Remove participant (admin only)
tournaments.delete("/:id/participants/:userId", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const appUserId = c.get("appUserId");

  const result = await tournamentService.removeParticipant(
    appUserId,
    tournamentId,
    targetUserId
  );

  return c.json(result);
});

// GET /users/search - Search users for participant addition
tournaments.get("/users/search", requireAuth, async (c) => {
  const query = c.req.query("q") || "";

  if (query.length < 2) {
    return c.json([]);
  }

  const users = await tournamentService.searchUsersForParticipant(query);
  return c.json(users);
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

// POST /tournaments/:id/generate-bracket - Generate bracket for tournament
tournaments.post("/:id/generate-bracket", requireAuth, async (c) => {
  const tournamentId = c.req.param("id");
  const appUserId = c.get("appUserId");

  // Validate tournament exists and user has permission
  const canManage = await tournamentService.canManageTournament(
    tournamentId,
    appUserId
  );

  if (!canManage) {
    return c.json({ error: "Permission refusée" }, 403);
  }

  // Import bracket generator service early to check and cleanup existing data
  const { bracketGeneratorService } = await import("../services/bracket-generator.service");

  // Check if bracket already exists (check both matches and stages)
  const { matchRepository } = await import("../repository/match.repository");
  const existingMatches = await matchRepository.list({ tournamentId });
  const hasExistingStages = await bracketGeneratorService.hasBracketData(tournamentId);

  if (existingMatches.length > 0) {
    return c.json({
      error: "Un bracket existe déjà pour ce tournoi. Supprimez les matchs existants avant de générer un nouveau bracket."
    }, 400);
  }

  // Clean up orphaned stages/groups/rounds if they exist without matches
  if (hasExistingStages) {
    await bracketGeneratorService.cleanupBracketData(tournamentId);
  }

  // Get bracket type from request body
  const body = await c.req.json();
  const bracketType = body.bracketType || "single"; // default to single elimination

  if (bracketType !== "single" && bracketType !== "double") {
    return c.json({ error: "Type de bracket invalide (single ou double)" }, 400);
  }

  // Get tournament participants
  const participants = await tournamentService.getTournamentParticipants(
    tournamentId
  );

  if (participants.length < 2) {
    return c.json({ error: "Au moins 2 participants requis pour générer un bracket" }, 400);
  }

  // Import team repository
  const { teamRepository } = await import("../repository/team.repository");

  // For participants without teams, create individual teams (for 1v1 bracket mode)
  const bracketParticipants: { teamId: string; seed: number; name: string }[] = [];
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    let teamId: string;
    let teamName: string;

    // If participant doesn't have a team, create one
    if (p.teamId) {
      teamId = p.teamId;
      // Need to fetch team name
      const team = await teamRepository.getById(teamId);
      teamName = team?.name || `Team ${i+1}`;
    } else {
      const team = await teamRepository.createTeamForParticipant(
        tournamentId,
        p.userId,
        p.id
      );
      teamId = team.id;
      teamName = team.name;
    }

    bracketParticipants.push({
      teamId,
      seed: i + 1,
      name: teamName,
    });
  }

  // Generate bracket
  // This now uses BracketsManager internally and writes directly to DB
  await bracketGeneratorService.generateBracket(
    tournamentId,
    bracketParticipants,
    bracketType
  );

  // No need to manually finalize byes or save, BracketsManager handles it (mostly).
  // If byes need progression, BracketsManager usually handles it if we start the stage?
  // Or we might need to manually trigger updates?
  // brackets-manager usually sets up the structure. Byes are handled by the structure (empty slots).
  // We can rely on brackets-viewer to render it correctly.

  return c.json({
    success: true,
    bracketType,
    message: `Bracket ${bracketType} généré avec succès`
  }, 201);
});

// GET /tournaments/:id/bracket - Get bracket structure
tournaments.get("/:id/bracket", async (c) => {
  const tournamentId = c.req.param("id");

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    return c.json({ error: "ID de tournoi invalide" }, 400);
  }

  // Import bracket generator service
  const { bracketGeneratorService } = await import("../services/bracket-generator.service");

  // Get all bracket data using BracketsManager via service
  const bracketData = await bracketGeneratorService.getBracketData(tournamentId);

  return c.json(bracketData);
});

export default tournaments;
