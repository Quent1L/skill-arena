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

  // Check if bracket already exists
  const { matchRepository } = await import("../repository/match.repository");
  const existingMatches = await matchRepository.list({ tournamentId });

  if (existingMatches.length > 0) {
    return c.json({
      error: "Un bracket existe déjà pour ce tournoi. Supprimez les matchs existants avant de générer un nouveau bracket."
    }, 400);
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

  // Import bracket generator service and team repository
  const { bracketGeneratorService } = await import("../services/bracket-generator.service");
  const { teamRepository } = await import("../repository/team.repository");

  // For participants without teams, create individual teams (for 1v1 bracket mode)
  const bracketParticipants: { teamId: string; seed: number }[] = [];
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    let teamId: string;

    // If participant doesn't have a team, create one
    if (p.teamId) {
      teamId = p.teamId;
    } else {
      const team = await teamRepository.createTeamForParticipant(
        tournamentId,
        p.userId,
        p.id
      );
      teamId = team.id;
    }

    bracketParticipants.push({
      teamId,
      seed: i + 1,
    });
  }

  // Generate bracket
  const bracket = await bracketGeneratorService.generateBracket(
    tournamentId,
    bracketParticipants,
    bracketType
  );

  // Auto-finalize bye matches (matches with only one team)
  for (const match of bracket) {
    if (match.teamAId && !match.teamBId) {
      // Team A has a bye, auto-advance them
      const createdMatch = await matchRepository.getByIdSimple(match.id!);
      if (createdMatch) {
        await matchRepository.update(createdMatch.id, {
          status: "finalized",
          winnerId: match.teamAId,
          winnerSide: "A",
          finalizedAt: new Date(),
          finalizationReason: "auto_validation",
        });

        // Progress the winner to next match
        if (createdMatch.nextMatchWinId) {
          const nextMatch = await matchRepository.getByIdSimple(createdMatch.nextMatchWinId);
          if (nextMatch) {
            if (!nextMatch.teamAId) {
              await matchRepository.updateMatchTeam(createdMatch.nextMatchWinId, "A", match.teamAId);
            } else if (!nextMatch.teamBId) {
              await matchRepository.updateMatchTeam(createdMatch.nextMatchWinId, "B", match.teamAId);
            }
          }
        }
      }
    } else if (!match.teamAId && match.teamBId) {
      // Team B has a bye, auto-advance them
      const createdMatch = await matchRepository.getByIdSimple(match.id!);
      if (createdMatch) {
        await matchRepository.update(createdMatch.id, {
          status: "finalized",
          winnerId: match.teamBId,
          winnerSide: "B",
          finalizedAt: new Date(),
          finalizationReason: "auto_validation",
        });

        // Progress the winner to next match
        if (createdMatch.nextMatchWinId) {
          const nextMatch = await matchRepository.getByIdSimple(createdMatch.nextMatchWinId);
          if (nextMatch) {
            if (!nextMatch.teamAId) {
              await matchRepository.updateMatchTeam(createdMatch.nextMatchWinId, "A", match.teamBId);
            } else if (!nextMatch.teamBId) {
              await matchRepository.updateMatchTeam(createdMatch.nextMatchWinId, "B", match.teamBId);
            }
          }
        }
      }
    }
  }

  return c.json({
    success: true,
    bracketType,
    matchesCreated: bracket.length,
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

  // Import match repository
  const { matchRepository } = await import("../repository/match.repository");

  // Get all bracket matches ordered by sequence
  const bracketMatches = await matchRepository.getBracketMatches(tournamentId);

  return c.json({
    tournamentId,
    matches: bracketMatches,
    totalMatches: bracketMatches.length,
  });
});

export default tournaments;
