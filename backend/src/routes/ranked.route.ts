import { zValidator } from "@hono/zod-validator";
import { rankedSeasonService } from "../services/ranked-season.service";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import {
  createRankedSeasonSchema,
  updateRankedSeasonSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";
import { NotFoundError, ErrorCode } from "../types/errors";

const ranked = createAppHono();

// POST /ranked/seasons - Create a new ranked season
ranked.post(
  "/seasons",
  requireAuth,
  zValidator("json", createRankedSeasonSchema),
  async (c) => {
    const data = c.req.valid("json");
    const appUserId = c.get("appUserId");
    const result = await rankedSeasonService.createSeason(data, appUserId);
    return c.json(result, 201);
  },
);

// GET /ranked/seasons - List ranked seasons
ranked.get("/seasons", async (c) => {
  const disciplineId = c.req.query("disciplineId");
  const status = c.req.query("status");
  const seasons = await rankedSeasonService.listSeasons({ disciplineId, status });
  return c.json(seasons);
});

// GET /ranked/seasons/:id - Get season details
ranked.get("/seasons/:id", async (c) => {
  const id = c.req.param("id")!;
  const season = await rankedSeasonService.getSeasonDetails(id);
  return c.json(season);
});

// PATCH /ranked/seasons/:id - Update season config (draft only)
ranked.patch(
  "/seasons/:id",
  requireAuth,
  zValidator("json", updateRankedSeasonSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const appUserId = c.get("appUserId");
    const season = await rankedSeasonService.updateSeason(id, data, appUserId);
    return c.json(season);
  },
);

// POST /ranked/seasons/:id/start - Start a ranked season
ranked.post("/seasons/:id/start", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const appUserId = c.get("appUserId");
  const season = await rankedSeasonService.startSeason(id, appUserId);
  return c.json(season);
});

// POST /ranked/seasons/:id/end - End a ranked season
ranked.post("/seasons/:id/end", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const appUserId = c.get("appUserId");
  const season = await rankedSeasonService.endSeason(id, appUserId);
  return c.json(season);
});

// GET /ranked/seasons/:id/leaderboard - Get season leaderboard
ranked.get("/seasons/:id/leaderboard", async (c) => {
  const id = c.req.param("id")!;
  const season = await rankedSeasonRepository.getSeasonWithConfig(id);
  if (!season) {
    throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
  }
  const players = await playerMmrRepository.getBySeasonOrdered(id);
  const boundaries = await rankedSeasonRepository.getRankBoundaries(id);
  return c.json({ players, boundaries });
});

// GET /ranked/seasons/:id/players/:playerId - Player MMR profile
ranked.get("/seasons/:id/players/:playerId", async (c) => {
  const { id, playerId } = c.req.param();
  const mmr = await playerMmrRepository.getBySeasonAndPlayer(id, playerId);
  if (!mmr) {
    throw new NotFoundError(ErrorCode.NOT_FOUND);
  }
  const boundaries = await rankedSeasonRepository.getRankBoundaries(id);
  return c.json({ mmr, boundaries });
});

// GET /ranked/seasons/:id/players/:playerId/history - MMR history
ranked.get("/seasons/:id/players/:playerId/history", async (c) => {
  const { id, playerId } = c.req.param();
  const history = await playerMmrRepository.getMmrHistory(id, playerId);
  return c.json(history);
});

export default ranked;
