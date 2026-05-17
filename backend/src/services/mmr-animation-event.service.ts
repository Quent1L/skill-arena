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

function getTierForMmr(mmr: number, tiers: TierData[]): TierData | null {
  if (tiers.length === 0) return null;
  return [...tiers].sort((a, b) => b.level - a.level).find((t) => mmr >= t.minMmr) ?? tiers[0];
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

    const mmrRecords = new Map<string, { currentMmr: number; matchesPlayed: number }>();
    for (const playerId of allPlayerIds) {
      const record = await playerMmrRepository.getBySeasonAndPlayer(tournamentId, playerId);
      mmrRecords.set(playerId, {
        currentMmr: record?.currentMmr ?? config.baseMmr,
        matchesPlayed: record?.matchesPlayed ?? 0,
      });
    }

    for (const playerId of allPlayerIds) {
      const playerInSideA = playerIdsA.includes(playerId);
      const opponentIds = playerInSideA ? playerIdsB : playerIdsA;
      const mySideScore = playerInSideA ? (sideA.score ?? 0) : (sideB.score ?? 0);
      const oppSideScore = playerInSideA ? (sideB.score ?? 0) : (sideA.score ?? 0);

      const { currentMmr, matchesPlayed } = mmrRecords.get(playerId)!;
      const oppMmrs = opponentIds.map((id) => mmrRecords.get(id)?.currentMmr ?? config.baseMmr);
      const opponentAvgMmr =
        oppMmrs.length > 0
          ? Math.round(oppMmrs.reduce((a, b) => a + b, 0) / oppMmrs.length)
          : config.baseMmr;

      const result: 1 | 0 | 0.5 =
        match.winnerSide === null ? 0.5 : match.winnerSide === "A" ? (playerInSideA ? 1 : 0) : playerInSideA ? 0 : 1;

      const isPlacement = matchesPlayed < config.placementMatches;
      const scoreCountsForMmr = match.outcomeType?.scoreCountsForMmr ?? true;
      const outcomePoints = match.outcomeType?.points ?? null;

      const kEffective = mmrCalculationService.calculateEffectiveK(
        config.kFactor,
        mySideScore,
        oppSideScore,
        isPlacement,
        scoreCountsForMmr,
        outcomePoints,
      );

      const delta = mmrCalculationService.calculateMmrDelta(currentMmr, opponentAvgMmr, result, kEffective);
      const mmrBefore = currentMmr;
      const mmrAfter = Math.max(1, currentMmr + delta);

      const tierBefore = getTierForMmr(mmrBefore, tiers);
      const tierAfter = getTierForMmr(mmrAfter, tiers);

      await mmrAnimationEventRepository.upsert({
        playerId,
        seasonId: tournamentId,
        matchId,
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
  }

  async createOfficialEventsAndBroadcast(matchId: string, tournamentId: string): Promise<void> {
    const config = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
    if (!config) return;

    const tiers = await rankedSeasonRepository.getRankTiers(tournamentId);
    const playerIds = await this.getMatchPlayerIds(matchId);

    for (const playerId of playerIds) {
      const history = await playerMmrRepository.getMmrHistoryForPlayerAndMatch(
        tournamentId,
        playerId,
        matchId,
      );
      if (!history) continue;

      const tierBefore = getTierForMmr(history.mmrBefore, tiers);
      const tierAfter = getTierForMmr(history.mmrAfter, tiers);
      const rankChanged = (tierBefore?.level ?? null) !== (tierAfter?.level ?? null);

      const event = await mmrAnimationEventRepository.upsert({
        playerId,
        seasonId: tournamentId,
        matchId,
        eventType: "official",
        reason: "match_finalized",
        mmrBefore: history.mmrBefore,
        mmrAfter: history.mmrAfter,
        mmrDelta: history.mmrDelta,
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

  private buildWsPayload(event: { id: string; matchId: string; seasonId: string; eventType: string; reason: string; mmrBefore: number; mmrAfter: number; mmrDelta: number; tierBeforeLevel: number | null; tierAfterLevel: number | null; tierBeforeName: string | null; tierAfterName: string | null; rankChanged: boolean; createdAt: Date }, tournamentId: string) {
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
      createdAt: event.createdAt,
    };
  }

  async getPendingForPlayer(playerId: string, seasonId: string) {
    return await mmrAnimationEventRepository.getPendingForPlayer(playerId, seasonId);
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
