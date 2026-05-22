import i18next from "../config/i18n";
import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { matches, matchSides, tournamentEntries, tournamentEntryPlayers } from "../db/schema";
import { mmrAnimationEventRepository } from "../repository/mmr-animation-event.repository";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { mmrCalculationService } from "./mmr-calculation.service";
import { webSocketService } from "./websocket.service";
import type { MmrAnimationEventReason } from "@skill-arena/shared";

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
    if (!match || match.status !== "reported") return;

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
    for (const playerId of playerIds) {
      const record = await playerMmrRepository.getBySeasonAndPlayer(seasonId, playerId);
      records.set(playerId, {
        currentMmr: record?.currentMmr ?? baseMmr,
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
      tierBeforeLevel: tierBefore?.level ?? null,
      tierAfterLevel: tierAfter?.level ?? null,
      tierBeforeName: tierBefore?.name ?? null,
      tierAfterName: tierAfter?.name ?? null,
      rankChanged: (tierBefore?.level ?? null) !== (tierAfter?.level ?? null),
    });
  }

  async createOfficialEventsAndBroadcast(matchId: string, tournamentId: string): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
    if (!config) return;

    const tiers = await rankedSeasonRepository.getRankTiers(tournamentId);
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      const events = await this.collectOfficialEvents(playerId, matchId, tournamentId, tiers);
      this.broadcastEvents(playerId, tournamentId, events);
    }
  }

  private async collectOfficialEvents(
    playerId: string,
    matchId: string,
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

      const event = await mmrAnimationEventRepository.upsert({
        playerId,
        seasonId,
        matchId: history.matchId,
        eventType: "official",
        reason,
        mmrBefore: history.mmrBefore,
        mmrAfter: history.mmrAfter,
        mmrDelta: history.mmrDelta,
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

  async createCancellationEventsAndBroadcast(
    matchId: string,
    tournamentId: string,
    mmrChanges: Map<string, { mmrBefore: number; mmrAfter: number; reason: MmrAnimationEventReason }>,
  ): Promise<void> {
    if (mmrChanges.size === 0) return;

    const tiers = await rankedSeasonRepository.getRankTiers(tournamentId);

    for (const [playerId, { mmrBefore, mmrAfter, reason }] of mmrChanges) {
      const mmrDelta = mmrAfter - mmrBefore;
      const tierBefore = getTierForMmr(mmrBefore, tiers);
      const tierAfter = getTierForMmr(mmrAfter, tiers);
      const rankChanged = (tierBefore?.level ?? null) !== (tierAfter?.level ?? null);

      const event = await mmrAnimationEventRepository.upsert({
        playerId,
        seasonId: tournamentId,
        matchId,
        eventType: "official",
        reason,
        mmrBefore,
        mmrAfter,
        mmrDelta,
        tierBeforeLevel: tierBefore?.level ?? null,
        tierAfterLevel: tierAfter?.level ?? null,
        tierBeforeName: tierBefore?.name ?? null,
        tierAfterName: tierAfter?.name ?? null,
        rankChanged,
      });

      webSocketService.send(playerId, {
        event: "mmr_animation",
        data: this.buildWsPayload(event, tournamentId),
      });
    }
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
      tierBeforeLevel: event.tierBeforeLevel,
      tierAfterLevel: event.tierAfterLevel,
      tierBeforeName: event.tierBeforeName,
      tierAfterName: event.tierAfterName,
      rankChanged: event.rankChanged,
      encouragementMessage: translateEncouragement(event.mmrDelta, event.eventType, event.rankChanged, "fr"),
      createdAt: event.createdAt,
    };
  }

  async getPendingForPlayer(playerId: string, seasonId: string, lang: string) {
    const events = await mmrAnimationEventRepository.getPendingForPlayer(playerId, seasonId);
    return events.map((event) => ({
      ...event,
      encouragementMessage: translateEncouragement(event.mmrDelta, event.eventType, event.rankChanged, lang),
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
