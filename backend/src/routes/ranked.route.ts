import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { rankedSeasonService, startOfWeekUtc } from "../services/ranked-season.service";
import { mmrAnimationEventService } from "../services/mmr-animation-event.service";
import { rulesService } from "../services/rules.service";
import { seasonRewindService } from "../services/season-rewind.service";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { rankedCacheRepository } from "../repository/ranked-cache.repository";
import {
  createRankedSeasonSchema,
  updateRankedSeasonSchema,
  createRankTierSchema,
  updateRankTierSchema,
} from "@skol-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";
import { NotFoundError, BadRequestError, ErrorCode } from "../types/errors";
import type { TournamentStatus } from "@skol-arena/shared/types/index";

const ranked = createAppHono();

// Tiers are addressed by level, not by id. A non-numeric segment used to slip
// through as NaN and silently match no row.
function parseTierLevel(raw: string): number {
  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1) {
    throw new BadRequestError(ErrorCode.INVALID_RANK_TIER_LEVEL);
  }
  return level;
}

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
// Returns the whole ladder: the requested level may have been clamped or may
// have pushed the tiers above it one level up.
ranked.post(
  "/seasons/:id/tiers",
  requireAuth,
  zValidator("json", createRankTierSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const tiers = await rankedSeasonRepository.insertTier(id, data);
    return c.json(tiers, 201);
  },
);

// PATCH /ranked/seasons/:id/tiers/:level - Update a rank tier
ranked.patch(
  "/seasons/:id/tiers/:level",
  requireAuth,
  zValidator("json", updateRankTierSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const level = parseTierLevel(c.req.param("level")!);
    const data = c.req.valid("json");
    const tier = await rankedSeasonRepository.updateTier(id, level, data);
    if (!tier) throw new NotFoundError(ErrorCode.RANK_TIER_NOT_FOUND);
    return c.json(tier);
  },
);

// DELETE /ranked/seasons/:id/tiers/:level - Delete a rank tier
// Returns the renumbered ladder: deleting a tier closes the gap it leaves.
ranked.delete("/seasons/:id/tiers/:level", requireAuth, async (c) => {
  const id = c.req.param("id")!;
  const level = parseTierLevel(c.req.param("level")!);
  const tiers = await rankedSeasonRepository.deleteTier(id, level);
  return c.json(tiers);
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
  // placementMatches ships with the leaderboard so the client can list unplaced
  // players apart without a second round trip; the season is already loaded here.
  const placementMatches = season.rankedConfig?.placementMatches ?? 0;
  const cached = await rankedCacheRepository.getOfficial(id);
  if (cached) return c.json({ players: cached.players, placementMatches });
  await rankedSeasonService.computeAndCacheOfficial(id);
  const fresh = await rankedCacheRepository.getOfficial(id);
  return c.json({ players: fresh?.players ?? [], placementMatches });
});

// GET /ranked/seasons/:id/leaderboard/provisional - Provisional leaderboard (cached)
ranked.get("/seasons/:id/leaderboard/provisional", async (c) => {
  const id = c.req.param("id")!;
  const season = await rankedSeasonRepository.getSeasonWithConfig(id);
  if (!season) {
    throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
  }
  const placementMatches = season.rankedConfig?.placementMatches ?? 0;
  const cached = await rankedCacheRepository.getProvisional(id);
  if (cached) return c.json({ players: cached.players, placementMatches });
  await rankedSeasonService.computeAndCacheProvisional(id);
  const fresh = await rankedCacheRepository.getProvisional(id);
  return c.json({ players: fresh?.players ?? [], placementMatches });
});

// GET /ranked/seasons/:id/leaderboard/season-stats - Peak + average MMR over the whole
// season (finished seasons only). Both metrics ship in one payload: same query cost,
// and the client switches between them without a second round trip.
ranked.get("/seasons/:id/leaderboard/season-stats", async (c) => {
  const id = c.req.param("id")!;
  const players = await rankedSeasonService.getSeasonMmrLeaderboard(id);
  return c.json({ players });
});

// GET /ranked/seasons/:id/players/:playerId - Player MMR profile
ranked.get("/seasons/:id/players/:playerId", async (c) => {
  const { id, playerId } = c.req.param();
  const [mmr, tiers, opponentQuality, chartHistory, config] = await Promise.all([
    playerMmrRepository.getBySeasonAndPlayer(id, playerId),
    rankedSeasonRepository.getRankTiers(id),
    playerMmrRepository.getOpponentQualityStats(id, playerId),
    playerMmrRepository.getMmrChartSeries(id, playerId),
    rankedSeasonRepository.getConfigByTournamentId(id),
  ]);
  if (!mmr) {
    throw new NotFoundError(ErrorCode.NOT_FOUND);
  }
  return c.json({
    mmr,
    tiers,
    opponentQuality,
    chartHistory,
    placementMatches: config?.placementMatches ?? 0,
  });
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

// GET /ranked/seasons/:id/weekly-mmr - Best MMR climbers / drops of the week
ranked.get(
  "/seasons/:id/weekly-mmr",
  zValidator("query", z.object({ from: z.string().datetime().optional() })),
  async (c) => {
    const id = c.req.param("id")!;
    const season = await rankedSeasonRepository.getSeasonWithConfig(id);
    if (!season) {
      throw new NotFoundError(ErrorCode.SEASON_NOT_FOUND);
    }
    // Clients send their own local Monday so the player tile and this ranking
    // share the exact same boundary; the UTC week is only a fallback.
    const { from } = c.req.valid("query");
    const weekStart = from ? new Date(from) : startOfWeekUtc(new Date());
    const leaders = await rankedSeasonService.getWeeklyMmrLeaders(id, weekStart);
    return c.json(leaders);
  },
);

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

// GET /ranked/seasons/:id/badge-animations/pending - Pending badge reveal animations
ranked.get("/seasons/:id/badge-animations/pending", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  const playerId = c.get("appUserId");
  const badges = await rulesService.getPendingBadges(playerId, seasonId);
  return c.json({ badges });
});

// POST /ranked/seasons/:id/badge-animations/mark-viewed - Mark badge animations as viewed
ranked.post(
  "/seasons/:id/badge-animations/mark-viewed",
  requireAuth,
  zValidator("json", z.object({ ids: z.array(z.string().uuid()) })),
  async (c) => {
    const { ids } = c.req.valid("json");
    const playerId = c.get("appUserId");
    await rulesService.markBadgesViewed(ids, playerId);
    return c.json({ success: true, markedCount: ids.length });
  },
);

// ============================================
// Season Rewind
// ============================================

// GET /ranked/rewinds/promoted - The rewind worth showing the player right now.
// Declared before /rewinds so the static segment is not eaten by a later route.
ranked.get("/rewinds/promoted", requireAuth, async (c) => {
  const playerId = c.get("appUserId");
  const promotion = await seasonRewindService.getPromoted(playerId);
  return c.json(promotion);
});

// GET /ranked/rewinds - Every rewind the player owns, no promotion window applied
ranked.get("/rewinds", requireAuth, async (c) => {
  const playerId = c.get("appUserId");
  const rewinds = await seasonRewindService.listArchive(playerId);
  return c.json(rewinds);
});

// GET /ranked/seasons/:id/rewind - Global season recap (public, like the leaderboard)
ranked.get("/seasons/:id/rewind", async (c) => {
  const seasonId = c.req.param("id")!;
  const bundle = await seasonRewindService.getBundle(seasonId, null);
  return c.json(bundle);
});

// GET /ranked/seasons/:id/rewind/me - Global recap + the caller's own deck, in one call
ranked.get("/seasons/:id/rewind/me", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  const bundle = await seasonRewindService.getBundle(seasonId, c.get("appUserId"));
  return c.json(bundle);
});

// POST /ranked/seasons/:id/rewind/opened - First open; stops the season page auto-opening it
ranked.post("/seasons/:id/rewind/opened", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  await seasonRewindService.markOpened(seasonId, c.get("appUserId"));
  return c.json({ success: true });
});

// POST /ranked/seasons/:id/rewind/viewed - Deck watched to the end; retires the promo card
ranked.post("/seasons/:id/rewind/viewed", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  await seasonRewindService.markViewed(seasonId, c.get("appUserId"));
  return c.json({ success: true });
});

// POST /ranked/seasons/:id/rewind/regenerate - Admin rebuild (keeps per-player state)
ranked.post("/seasons/:id/rewind/regenerate", requireAuth, async (c) => {
  const seasonId = c.req.param("id")!;
  await rankedSeasonService.regenerateRewind(seasonId, c.get("appUserId"));
  return c.json({ success: true });
});

export default ranked;
