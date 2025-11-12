import { zValidator } from "@hono/zod-validator";
import { matchService } from "../services/match.service";
import {
  createMatchSchema,
  updateMatchSchema,
  reportMatchResultSchema,
  confirmMatchResultSchema,
  listMatchesQuerySchema,
  validateMatchSchema,
} from "@skill-arena/shared";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const matches = createAppHono();

// POST /matches - Create new match
matches.post(
  "/",
  requireAuth,
  zValidator("json", createMatchSchema),
  async (c) => {
    try {
      const appUserId = c.get("appUserId");
      const data = c.req.valid("json");

      const match = await matchService.createMatch(
        {
          tournamentId: data.tournamentId,
          round: data.round,
          teamAId: data.teamAId,
          teamBId: data.teamBId,
          playerIdsA: data.playerIdsA,
          playerIdsB: data.playerIdsB,
          status: data.status,
        },
        appUserId
      );

      return c.json(match, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  }
);

// GET /matches - List matches (with filters)
matches.get("/", zValidator("query", listMatchesQuerySchema), async (c) => {
  try {
    const filters = c.req.valid("query");
    const matchesList = await matchService.listMatches(filters);
    return c.json(matchesList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// GET /matches/:id - Get single match
matches.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const match = await matchService.getMatchById(id);
    return c.json(match);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Match non trouvé" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

// PATCH /matches/:id - Update match
matches.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateMatchSchema),
  async (c) => {
    try {
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
        },
        appUserId
      );

      return c.json(match);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = message.includes("permission") ? 403 : 400;
      return c.json({ error: message }, status);
    }
  }
);

// DELETE /matches/:id - Delete match
matches.delete("/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const appUserId = c.get("appUserId");

    const result = await matchService.deleteMatch(id, appUserId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("permission") ? 403 : 400;
    return c.json({ error: message }, status);
  }
});

// POST /matches/:id/report - Report match result
matches.post(
  "/:id/report",
  requireAuth,
  zValidator("json", reportMatchResultSchema),
  async (c) => {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  }
);

// POST /matches/:id/confirm - Confirm match result
matches.post(
  "/:id/confirm",
  requireAuth,
  zValidator("json", confirmMatchResultSchema),
  async (c) => {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  }
);

// POST /matches/validate - Validate match possibility
matches.post(
  "/validate",
  zValidator("json", validateMatchSchema),
  async (c) => {
    try {
      const data = c.req.valid("json");

      const validation = await matchService.validateMatch({
        tournamentId: data.tournamentId,
        round: data.round,
        teamAId: data.teamAId,
        teamBId: data.teamBId,
        playerIdsA: data.playerIdsA,
        playerIdsB: data.playerIdsB,
      });

      return c.json(validation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  }
);

export default matches;
