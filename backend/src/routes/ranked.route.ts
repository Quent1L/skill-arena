import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { rankedSeasonService } from "../services/ranked-season.service";
import { mmrAnimationEventService } from "../services/mmr-animation-event.service";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { rankedCacheRepository } from "../repository/ranked-cache.repository";
import {
  createRankedSeasonSchema,
  updateRankedSeasonSchema,
  createRankTierSchema,
  updateRankTierSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";
import { NotFoundError, ErrorCode } from "../types/errors";
import type { TournamentStatus } from "@skill-arena/shared/types/index";

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
  const status = c.req.query("status") as TournamentStatus | undefined;
  const seasons = await rankedSeasonService.listSeasons({ disciplineId, status });
  return c.json(seasons);
});

// GET /ranked/seasons/finished - List finished seasons (for tier source dropdown)
ranked.get("/seasons/finished", async (c) => {
  const seasons = await rankedSeasonRepository.getFinishedSeasons();
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

// GET /ranked/seasons/:id/tiers - List rank tiers
ranked.get("/seasons/:id/tiers", async (c) => {
  const id = c.req.param("id")!;
  const tiers = await rankedSeasonRepository.getRankTiers(id);
  return c.json(tiers);
});

// POST /ranked/seasons/:id/tiers - Create a rank tier
ranked.post(
  "/seasons/:id/tiers",
  requireAuth,
  zValidator("json", createRankTierSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const tier = await rankedSeasonRepository.insertTier(id, data);
    return c.json(tier, 201);
  },
);

// PATCH /ranked/seasons/:id/tiers/:level - Update a rank tier
ranked.patch(
  "/seasons/:id/tiers/:level",
  requireAuth,
  zValidator("json", updateRankTierSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const level = Number(c.req.param("level")!);
    const data = c.req.valid("json");
    const tier = await rankedSeasonRepository.updateTier(id, level, data);
    return c.json(tier);
  },
);

// DELETE /ranked/seasons/:id/tiers/:level - Delete a rank tier
ranked.delete("/seasons/:id/tiers/:level", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const level = Number(c.req.param("level")!);
  await rankedSeasonRepository.deleteTier(id, level);
  return c.json({ success: true });
});

// POST /ranked/seasons/:id/tiers/recalculate - Recalculate tier MMR boundaries
ranked.post("/seasons/:id/tiers/recalculate", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const config = await rankedSeasonRepository.getConfigByTournamentId(id);
  if (!config) {
    throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
  }
  await rankedSeasonService.recalculateTierMinMmr(id, config.baseMmr);
  const tiers = await rankedSeasonRepository.getRankTiers(id);
  return c.json(tiers);
});

// GET /ranked/seasons/:id/leaderboard - Get season leaderboard (cached)
ranked.get("/seasons/:id/leaderboard", async (c) => {
  const id = c.req.param("id")!;
  const season = await rankedSeasonRepository.getSeasonWithConfig(id);
  if (!season) {
    throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
  }
  const cached = await rankedCacheRepository.getOfficial(id);
  if (cached) return c.json({ players: cached.players });
  await rankedSeasonService.computeAndCacheOfficial(id);
  const fresh = await rankedCacheRepository.getOfficial(id);
  return c.json({ players: fresh?.players ?? [] });
});

// GET /ranked/seasons/:id/leaderboard/provisional - Provisional leaderboard (cached)
ranked.get("/seasons/:id/leaderboard/provisional", async (c) => {
  const id = c.req.param("id")!;
  const season = await rankedSeasonRepository.getSeasonWithConfig(id);
  if (!season) {
    throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
  }
  const cached = await rankedCacheRepository.getProvisional(id);
  if (cached) return c.json({ players: cached.players });
  await rankedSeasonService.computeAndCacheProvisional(id);
  const fresh = await rankedCacheRepository.getProvisional(id);
  return c.json({ players: fresh?.players ?? [] });
});

// GET /ranked/seasons/:id/players/:playerId - Player MMR profile
ranked.get("/seasons/:id/players/:playerId", async (c) => {
  const { id, playerId } = c.req.param();
  const [mmr, tiers, opponentQuality] = await Promise.all([
    playerMmrRepository.getBySeasonAndPlayer(id, playerId),
    rankedSeasonRepository.getRankTiers(id),
    playerMmrRepository.getOpponentQualityStats(id, playerId),
  ]);
  if (!mmr) {
    throw new NotFoundError(ErrorCode.NOT_FOUND);
  }
  return c.json({ mmr, tiers, opponentQuality });
});

// GET /ranked/seasons/:id/players/:playerId/history - MMR history
ranked.get("/seasons/:id/players/:playerId/history", async (c) => {
  const { id, playerId } = c.req.param();
  const limit = Number(c.req.query("limit") ?? 10);
  const offset = Number(c.req.query("offset") ?? 0);

  const history = await playerMmrRepository.getMmrHistory(id, playerId, limit, offset);
  const matchIds = history.map((h) => h.matchId);
  const sidesData = await playerMmrRepository.getMatchPlayersForHistory(matchIds);

  const sidesMap = new Map<string, { position: number; players: { id: string; displayName: string; shortName: string }[] }[]>();
  for (const side of sidesData) {
    const list = sidesMap.get(side.matchId) ?? [];
    list.push({
      position: side.position,
      players: (side.entry?.players ?? []).map((p) => ({
        id: p.player.id,
        displayName: p.player.displayName,
        shortName: p.player.shortName ?? p.player.displayName,
      })),
    });
    sidesMap.set(side.matchId, list);
  }

  const enriched = history.map((h) => ({ ...h, sides: sidesMap.get(h.matchId) ?? [] }));
  return c.json(enriched);
});

// GET /ranked/seasons/:id/animation-events/pending - Get pending MMR animation events
ranked.get("/seasons/:id/animation-events/pending", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  const playerId = c.get("appUserId");
  const events = await mmrAnimationEventService.getPendingForPlayer(playerId, seasonId, c.get("lang"));
  return c.json({ events });
});

// POST /ranked/seasons/:id/animation-events/mark-viewed - Mark events as viewed
ranked.post(
  "/seasons/:id/animation-events/mark-viewed",
  requireAuth,
  zValidator("json", z.object({ ids: z.array(z.string().uuid()) })),
  async (c) => {
    const { ids } = c.req.valid("json");
    await mmrAnimationEventService.markViewed(ids);
    return c.json({ success: true, markedCount: ids.length });
  },
);

export default ranked;
