import { zValidator } from "@hono/zod-validator";
import { matchService } from "../services/match.service";
import {
  createMatchSchema,
  updateMatchSchema,
  reportMatchResultSchema,
  confirmMatchResultSchema,
  listMatchesQuerySchema,
  validateMatchSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const matches = createAppHono();

// POST /matches - Create new match
matches.post(
  "/",
  requireAuth,
  zValidator("json", createMatchSchema),
  async (c) => {
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const match = await matchService.createMatch(data, appUserId);

    return c.json(match, 201);
  }
);

// GET /matches - List matches (with filters)
matches.get("/", zValidator("query", listMatchesQuerySchema), async (c) => {
  const filters = c.req.valid("query");
  const matchesList = await matchService.listMatches(filters);
  return c.json(matchesList);
});

// GET /matches/:id - Get single match
matches.get("/:id", async (c) => {
  const id = c.req.param("id");
  const match = await matchService.getMatchById(id);
  return c.json(match);
});

// PATCH /matches/:id - Update match
matches.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateMatchSchema),
  async (c) => {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const match = await matchService.updateMatch(
      id,
      {
        round: data.round,
        scoreA: data.scoreA,
        scoreB: data.scoreB,
        status: data.status,
        reportProof: data.reportProof,
        outcomeTypeId: data.outcomeTypeId,
        outcomeReasonId: data.outcomeReasonId,
        playedAt: data.playedAt,
      },
      appUserId
    );

    return c.json(match);
  }
);

// DELETE /matches/:id - Delete match
matches.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const appUserId = c.get("appUserId");

  const result = await matchService.deleteMatch(id, appUserId);
  return c.json(result);
});

// POST /matches/:id/report - Report match result
matches.post(
  "/:id/report",
  requireAuth,
  zValidator("json", reportMatchResultSchema),
  async (c) => {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const match = await matchService.reportMatchResult(
      id,
      {
        scoreA: data.scoreA,
        scoreB: data.scoreB,
        reportProof: data.reportProof,
      },
      appUserId
    );

    return c.json(match);
  }
);

// POST /matches/:id/confirm - Confirm match result
matches.post(
  "/:id/confirm",
  requireAuth,
  zValidator("json", confirmMatchResultSchema),
  async (c) => {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");
    const data = c.req.valid("json");

    const match = await matchService.confirmMatchResult(
      id,
      {
        confirmed: data.confirmed,
      },
      appUserId
    );

    return c.json(match);
  }
);

// POST /matches/validate - Validate match possibility
matches.post(
  "/validate",
  zValidator("json", validateMatchSchema),
  async (c) => {
    const data = c.req.valid("json");

    const validation = await matchService.validateMatch({
      tournamentId: data.tournamentId,
      round: data.round,
      teamAId: data.teamAId,
      teamBId: data.teamBId,
      playerIdsA: data.playerIdsA,
      playerIdsB: data.playerIdsB,
      matchId: data.matchId, // Pass matchId to exclude from validation (for edit mode)
      playedAt: data.playedAt,
    });

    return c.json(validation);
  }
);

export default matches;
