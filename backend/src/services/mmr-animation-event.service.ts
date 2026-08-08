import i18next from "../config/i18n";
import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { matches, matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { mmrAnimationEventRepository } from "../repository/mmr-animation-event.repository";
import type { UpsertMmrAnimationEventData } from "../repository/mmr-animation-event.repository";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { mmrSeedRepository } from "../repository/mmr-seed.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { mmrCalculationService } from "./mmr-calculation.service";
import { webSocketService } from "./websocket.service";
import type { MmrAnimationEventReason, PlayerRulesOutput } from "@skol-arena/shared";

type TierData = { level: number; name: string; minMmr: number };
type MmrRecord = { currentMmr: number; matchesPlayed: number };
type MmrAnimationEventRecord = Awaited<ReturnType<typeof mmrAnimationEventRepository.upsert>>;

interface ProvisionalContext {
  matchId: string;
  seasonId: string;
  playerIdsA: string[];
  playerIdsB: string[];
  scoreA: number;
  scoreB: number;
  winnerSide: string | null;
  baseMmr: number;
  placementMatches: number;
  kFactor: number;
  scoreCountsForMmr: boolean;
  outcomePoints: number | null;
  tiers: TierData[];
  mmrRecords: Map<string, MmrRecord>;
}

function resolveEncouragementKey(mmrDelta: number, eventType: string, rankChanged: boolean): string | null {
  if (rankChanged && eventType !== "provisional") return null;
  if (eventType === "provisional") return "ranked.PROVISIONAL";
  if (mmrDelta >= 40) return "ranked.EXCEPTIONAL";
  if (mmrDelta >= 20) return "ranked.EXCELLENT";
  if (mmrDelta > 0) return "ranked.GOOD";
  if (mmrDelta === 0) return "ranked.DRAW";
  if (mmrDelta >= -20) return "ranked.LOSS_MINOR";
  return "ranked.LOSS_MAJOR";
}

function translateEncouragement(mmrDelta: number, eventType: string, rankChanged: boolean, lang: string): string | null {
  const key = resolveEncouragementKey(mmrDelta, eventType, rankChanged);
  if (!key) return null;
  return String(i18next.t(key, { lng: lang }));
}

function getTierForMmr(mmr: number, tiers: TierData[]): TierData | null {
  if (tiers.length === 0) return null;
  return [...tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? tiers[0];
}

function resolveResult(winnerSide: string | null, playerInSideA: boolean): 1 | 0 | 0.5 {
  if (winnerSide === null) return 0.5;
  return (winnerSide === "A") === playerInSideA ? 1 : 0;
}

export class MmrAnimationEventService {
  async createProvisionalEventsForMatch(matchId: string, tournamentId: string): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
    if (!config) return;

    const tiers = await rankedSeasonRepository.getRankTiers(tournamentId);

    const match = await db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: { outcomeType: true },
    });
    if (match?.status !== "reported") return;

    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
      orderBy: (s, { asc }) => [asc(s.position)],
      with: {
        entry: {
          with: {
            players: true,
          },
        },
      },
    });
    if (sides.length < 2) return;

    const sideA = sides[0];
    const sideB = sides[1];
    const playerIdsA = sideA.entry?.players.map((p) => p.playerId) ?? [];
    const playerIdsB = sideB.entry?.players.map((p) => p.playerId) ?? [];
    const allPlayerIds = [...playerIdsA, ...playerIdsB];

    const mmrRecords = await this.loadMmrRecords(allPlayerIds, tournamentId, config.baseMmr);

    const ctx: ProvisionalContext = {
      matchId,
      seasonId: tournamentId,
      playerIdsA,
      playerIdsB,
      scoreA: sideA.score ?? 0,
      scoreB: sideB.score ?? 0,
      winnerSide: match.winnerSide,
      baseMmr: config.baseMmr,
      placementMatches: config.placementMatches,
      kFactor: config.kFactor,
      scoreCountsForMmr: match.outcomeType?.scoreCountsForMmr ?? true,
      outcomePoints: match.outcomeType?.points ?? null,
      tiers,
      mmrRecords,
    };

    for (const playerId of allPlayerIds) {
      await this.buildProvisionalEvent(playerId, ctx);
    }
  }

  private async loadMmrRecords(
    playerIds: string[],
    seasonId: string,
    baseMmr: number,
  ): Promise<Map<string, MmrRecord>> {
    const records = new Map<string, MmrRecord>();
    // No row yet means the player has not played this season: their MMR is the one
    // carried over from the previous season, if any, not baseMmr.
    const entryMmr = await mmrSeedRepository.getMapBySeason(seasonId);
    for (const playerId of playerIds) {
      const record = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
      records.set(playerId, {
        currentMmr: record?.currentMmr ?? entryMmr.get(playerId) ?? baseMmr,
        matchesPlayed: record?.matchesPlayed ?? 0,
      });
    }
    return records;
  }

  private averageOpponentMmr(opponentIds: string[], ctx: ProvisionalContext): number {
    const oppMmrs = opponentIds.map((id) => ctx.mmrRecords.get(id)?.currentMmr ?? ctx.baseMmr);
    if (oppMmrs.length === 0) return ctx.baseMmr;
    return Math.round(oppMmrs.reduce((a, b) => a + b, 0) / oppMmrs.length);
  }

  private async buildProvisionalEvent(playerId: string, ctx: ProvisionalContext): Promise<void> {
    const playerInSideA = ctx.playerIdsA.includes(playerId);
    const opponentIds = playerInSideA ? ctx.playerIdsB : ctx.playerIdsA;
    const mySideScore = playerInSideA ? ctx.scoreA : ctx.scoreB;
    const oppSideScore = playerInSideA ? ctx.scoreB : ctx.scoreA;

    const { currentMmr, matchesPlayed } = ctx.mmrRecords.get(playerId)!;
    const opponentAvgMmr = this.averageOpponentMmr(opponentIds, ctx);
    const result = resolveResult(ctx.winnerSide, playerInSideA);
    const isPlacement = matchesPlayed < ctx.placementMatches;

    const kEffective = mmrCalculationService.calculateEffectiveK(
      ctx.kFactor,
      mySideScore,
      oppSideScore,
      isPlacement,
      ctx.scoreCountsForMmr,
      ctx.outcomePoints,
    );

    const delta = mmrCalculationService.calculateMmrDelta(currentMmr, opponentAvgMmr, result, kEffective);
    const mmrBefore = currentMmr;
    const mmrAfter = Math.max(1, currentMmr + delta);
    const tierBefore = getTierForMmr(mmrBefore, ctx.tiers);
    const tierAfter = getTierForMmr(mmrAfter, ctx.tiers);

    await mmrAnimationEventRepository.upsert({
      playerId,
      seasonId: ctx.seasonId,
      matchId: ctx.matchId,
      eventType: "provisional",
      reason: "match_finalized",
      mmrBefore,
      mmrAfter,
      mmrDelta: delta,
      displayDelta: delta,
      tierBeforeLevel: tierBefore?.level ?? null,
      tierAfterLevel: tierAfter?.level ?? null,
      tierBeforeName: tierBefore?.name ?? null,
      tierAfterName: tierAfter?.name ?? null,
      rankChanged: (tierBefore?.level ?? null) !== (tierAfter?.level ?? null),
    });
  }

  async createOfficialEventsAndBroadcast(
    matchId: string,
    tournamentId: string,
    rulesOutputs: Map<string, PlayerRulesOutput> = new Map(),
  ): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
    if (!config) return;

    const tiers = await rankedSeasonRepository.getRankTiers(tournamentId);
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      const events = await this.collectOfficialEvents(playerId, matchId, tournamentId, tiers);
      const ruleOutput = rulesOutputs.get(playerId);

      // Rules-generated message replaces the default encouragement, but only
      // when there is a single animation (not a recap/cascade).
      if (events.length === 1 && ruleOutput?.message) {
        await mmrAnimationEventRepository.updateMessage(events[0].id, ruleOutput.message);
        events[0] = { ...events[0], message: ruleOutput.message };
      }

      this.broadcastEvents(playerId, tournamentId, events);

      // Badge reveal animations, chained after the MMR animation.
      for (const badge of ruleOutput?.badges ?? []) {
        webSocketService.send(playerId, {
          event: "badge_animation",
          data: {
            id: badge.badgeId,
            matchId,
            seasonId: tournamentId,
            tournamentId,
            icon: badge.icon,
            label: badge.label,
            description: badge.description,
            createdAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  private async collectOfficialEvents(
    playerId: string,
    matchId: string | null,
    seasonId: string,
    tiers: TierData[],
  ): Promise<MmrAnimationEventRecord[]> {
    const allHistory = await playerMmrRepository.getMmrHistoryOrdered(seasonId, playerId);
    const existingEvents = await mmrAnimationEventRepository.getOfficialEventDeltasByPlayer(seasonId, playerId);
    const events: MmrAnimationEventRecord[] = [];

    for (const history of allHistory) {
      const isCurrentMatch = history.matchId === matchId;
      const existing = existingEvents.get(history.matchId);

      if (!isCurrentMatch && (!existing || existing.mmrDelta === history.mmrDelta)) continue;

      const tierBefore = getTierForMmr(history.mmrBefore, tiers);
      const tierAfter = getTierForMmr(history.mmrAfter, tiers);
      const reason: MmrAnimationEventReason = isCurrentMatch ? "match_finalized" : "recalculated";
      // Show only the change since the player last saw this match. seenDelta is 0
      // for a never-seen match (a brand-new finalized match), so this naturally
      // equals the full delta there and the recalc differential otherwise.
      const displayDelta = history.mmrDelta - (existing?.seenDelta ?? 0);

      const event = await mmrAnimationEventRepository.upsert({
        playerId,
        seasonId,
        matchId: history.matchId,
        eventType: "official",
        reason,
        mmrBefore: history.mmrBefore,
        mmrAfter: history.mmrAfter,
        mmrDelta: history.mmrDelta,
        displayDelta,
        tierBeforeLevel: tierBefore?.level ?? null,
        tierAfterLevel: tierAfter?.level ?? null,
        tierBeforeName: tierBefore?.name ?? null,
        tierAfterName: tierAfter?.name ?? null,
        rankChanged: (tierBefore?.level ?? null) !== (tierAfter?.level ?? null),
      });
      events.push(event);
    }

    return events;
  }

  private broadcastEvents(playerId: string, tournamentId: string, events: MmrAnimationEventRecord[]): void {
    for (const event of events) {
      webSocketService.send(playerId, {
        event: "mmr_animation",
        data: this.buildWsPayload(event, tournamentId),
      });
    }
  }

  // Persist the cancelled-match removal event for the match's DIRECT players
  // only (no live broadcast — the worker fires a single mmr_recap_ready ping so
  // the client refetches all pending events as one grouped recap).
  //
  // Cascade-only players are intentionally skipped: their net change is already
  // captured by the per-match differentials persistRecalcEvents emits, so adding
  // a per-player net summary here would double-count it in the recap.
  //
  // For a direct player, displayDelta = -(delta they last saw for the cancelled
  // match) — the points the removed match contributed and now lose. Combined
  // with the posterior differentials this sums to the player's true net change.
  // No tier badge: the resulting rank movement is the cumulative effect of the
  // removal + all posterior recalcs, already carried by the posterior rows and
  // the headline net — showing the full-net tier swing on this partial row would
  // be misleading and double-counted. mmrBefore/mmrAfter keep the net snapshot.
  // Returns player ids that got an event.
  async persistCancellationEvents(
    matchId: string,
    tournamentId: string,
    mmrChanges: Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>,
  ): Promise<string[]> {
    const directEntries = [...mmrChanges].filter(([, c]) => c.reason === "match_cancelled");
    if (directEntries.length === 0) return [];

    const directPlayerIds = directEntries.map(([playerId]) => playerId);
    const seenDeltas = await mmrAnimationEventRepository.getOfficialEventDeltasForPlayers(
      tournamentId,
      directPlayerIds,
    );
    const rows: UpsertMmrAnimationEventData[] = [];

    for (const [playerId, { mmrBefore, mmrAfter, reason }] of directEntries) {
      const seenDelta = seenDeltas.get(playerId)?.get(matchId)?.seenDelta ?? 0;
      const displayDelta = -seenDelta;
      if (displayDelta === 0) continue;

      rows.push({
        playerId,
        seasonId: tournamentId,
        matchId,
        eventType: "official",
        reason,
        mmrBefore,
        mmrAfter,
        mmrDelta: mmrAfter - mmrBefore,
        displayDelta,
        tierBeforeLevel: null,
        tierAfterLevel: null,
        tierBeforeName: null,
        tierAfterName: null,
        rankChanged: false,
      });
    }

    await mmrAnimationEventRepository.bulkUpsert(rows);
    return [...new Set(rows.map((r) => r.playerId))];
  }

  // Re-sync after an MMR history rebuild (forced season recalc or cancellation
  // cascade). Persists a "recalculated" event for each past match whose delta
  // actually changed — keeping mmr_animation_events in sync so the next match
  // finalization does not replay a phantom recap. Batched: 2 reads + 1 write
  // for the whole cascade, no per-event broadcast. Returns player ids that got
  // at least one event.
  async persistRecalcEvents(seasonId: string, playerIds: string[]): Promise<string[]> {
    if (playerIds.length === 0) return [];

    const config = await rankedSeasonRepository.getConfigByTournamentId(seasonId);
    if (!config) return [];

    const tiers = await rankedSeasonRepository.getRankTiers(seasonId);
    const historyByPlayer = await playerMmrRepository.getMmrHistoryOrderedForPlayers(seasonId, playerIds);
    const existingByPlayer = await mmrAnimationEventRepository.getOfficialEventDeltasForPlayers(seasonId, playerIds);

    const rows: UpsertMmrAnimationEventData[] = [];
    const affected = new Set<string>();

    for (const playerId of playerIds) {
      const history = historyByPlayer.get(playerId) ?? [];
      const existing = existingByPlayer.get(playerId);
      if (!existing) continue;

      for (const h of history) {
        const prev = existing.get(h.matchId);
        if (!prev || prev.mmrDelta === h.mmrDelta) continue;

        const tierBefore = getTierForMmr(h.mmrBefore, tiers);
        const tierAfter = getTierForMmr(h.mmrAfter, tiers);
        rows.push({
          playerId,
          seasonId,
          matchId: h.matchId,
          eventType: "official",
          reason: "recalculated",
          mmrBefore: h.mmrBefore,
          mmrAfter: h.mmrAfter,
          mmrDelta: h.mmrDelta,
          // Only the change since the player last saw this match (prev is present
          // and its full delta differs — guaranteed by the continue guard above).
          // Baseline is seenDelta, not the stored full delta, so back-to-back
          // recalcs before viewing accumulate instead of overwriting.
          displayDelta: h.mmrDelta - prev.seenDelta,
          tierBeforeLevel: tierBefore?.level ?? null,
          tierAfterLevel: tierAfter?.level ?? null,
          tierBeforeName: tierBefore?.name ?? null,
          tierAfterName: tierAfter?.name ?? null,
          rankChanged: (tierBefore?.level ?? null) !== (tierAfter?.level ?? null),
        });
        affected.add(playerId);
      }
    }

    await mmrAnimationEventRepository.bulkUpsert(rows);
    return [...affected];
  }

  private buildWsPayload(event: MmrAnimationEventRecord, tournamentId: string) {
    return {
      id: event.id,
      matchId: event.matchId,
      seasonId: event.seasonId,
      tournamentId,
      eventType: event.eventType,
      reason: event.reason,
      mmrBefore: event.mmrBefore,
      mmrAfter: event.mmrAfter,
      mmrDelta: event.mmrDelta,
      displayDelta: event.displayDelta ?? event.mmrDelta,
      tierBeforeLevel: event.tierBeforeLevel,
      tierAfterLevel: event.tierAfterLevel,
      tierBeforeName: event.tierBeforeName,
      tierAfterName: event.tierAfterName,
      rankChanged: event.rankChanged,
      encouragementMessage:
        event.message ?? translateEncouragement(event.mmrDelta, event.eventType, event.rankChanged, "fr"),
      createdAt: event.createdAt,
    };
  }

  async getPendingForPlayer(playerId: string, seasonId: string, lang: string) {
    const events = await mmrAnimationEventRepository.getPendingForPlayer(playerId, seasonId);
    return events.map((event) => ({
      ...event,
      displayDelta: event.displayDelta ?? event.mmrDelta,
      encouragementMessage:
        event.message ?? translateEncouragement(event.mmrDelta, event.eventType, event.rankChanged, lang),
    }));
  }

  async markViewed(ids: string[]) {
    await mmrAnimationEventRepository.markViewed(ids);
  }

  private async getMatchPlayerIds(matchId: string): Promise<string[]> {
    const rows = await db
      .select({ playerId: tournamentEntryPlayers.playerId })
      .from(matchSides)
      .innerJoin(tournamentEntries, eq(matchSides.entryId, tournamentEntries.id))
      .innerJoin(tournamentEntryPlayers, eq(tournamentEntries.id, tournamentEntryPlayers.entryId))
      .where(eq(matchSides.matchId, matchId));
    return [...new Set(rows.map((r) => r.playerId))];
  }
}

export const mmrAnimationEventService = new MmrAnimationEventService();
