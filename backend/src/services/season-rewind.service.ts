import {
  REWIND_PROMO_DAYS,
  REWIND_VERSION,
  type ClientPlayerBadge,
  type PlayerRelationStat,
  type PlayerRewindPayload,
  type RewindArchiveEntry,
  type RewindBundle,
  type RewindConclusion,
  type RewindFeatMatch,
  type RewindPlayerRef,
  type RewindPromotion,
  type RewindSeasonInfo,
  type RuleAction,
  type SeasonRewindPayload,
} from "@skol-arena/shared/types/index";
import { db } from "../config/database";
import { playerMmrRepository } from "../repository/player-mmr.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { rulesRepository } from "../repository/rules.repository";
import {
  seasonRewindRepository,
  type PlayerRewindRow,
} from "../repository/season-rewind.repository";
import { NotFoundError, BadRequestError } from "../types/errors";
import { ErrorCode } from "../types/errors";
import { logger } from "../utils/logger";
import { rankRelationsByWeightedRate } from "./player-stats.service";
import {
  awardsWonBy,
  computeCombatAwards,
  computeCooperationAwards,
  computeEnduranceAwards,
  computePercentiles,
  computePerformanceAwards,
} from "./season-rewind.awards";
import { replaySeason, type PairTally, type PlayerAggregate } from "./season-rewind.replay";
import type { FeatDraft } from "./season-rewind.replay";

type Directory = Map<string, RewindPlayerRef>;
type BadgeRow = Awaited<ReturnType<typeof rulesRepository.listBadgesBySeason>>[number];

interface SeasonContext {
  info: RewindSeasonInfo;
  disciplineId: string | null;
  directory: Directory;
  finalRanking: string[];
  tierByPlayer: Map<string, { name: string; level: number }>;
  averageMmr: number;
}

export class SeasonRewindService {
  /**
   * Builds and stores the whole rewind for a finished season.
   *
   * Everything is computed once here and never recomputed on read: once a season
   * is closed its data is frozen, so paying the cost of a full chronological
   * replay on every page view would be pure waste. Regenerating is safe — the
   * per-player promotion window and viewed state are preserved by the upsert.
   */
  async generateForSeason(seasonId: string): Promise<void> {
    const season = await rankedSeasonRepository.getSeasonWithConfig(seasonId);
    if (!season) throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    if (season.status !== "finished") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS);
    }

    const [history, sides, players, badges] = await Promise.all([
      seasonRewindRepository.getSeasonHistoryOrdered(seasonId),
      seasonRewindRepository.getSeasonSides(seasonId),
      playerMmrRepository.getBySeasonOrdered(seasonId),
      rulesRepository.listBadgesBySeason(seasonId),
    ]);

    const replay = replaySeason(history, sides);
    const context = this.buildContext(season, players);
    const aggregates = [...replay.aggregates.values()].filter((agg) =>
      context.directory.has(agg.playerId),
    );

    const seasonPayload = this.buildSeasonPayload(context, aggregates, replay);
    const nextSeason = await this.findNextSeason(context.disciplineId, seasonId);
    const promotedUntil = new Date(Date.now() + REWIND_PROMO_DAYS * 24 * 60 * 60 * 1000);

    const playerRows = aggregates.map((agg) => ({
      playerId: agg.playerId,
      promotedUntil,
      payload: this.buildPlayerPayload(agg, aggregates, replay, context, seasonPayload, {
        badges: badges.filter((badge) => badge.playerId === agg.playerId),
        nextSeason,
      }),
    }));

    await this.persist(seasonId, context.disciplineId, seasonPayload, playerRows);
    logger.info(
      { seasonId, players: playerRows.length, matches: replay.matchCount },
      "[Rewind] season rewind generated",
    );
  }

  private async persist(
    seasonId: string,
    disciplineId: string | null,
    payload: SeasonRewindPayload,
    rows: PlayerRewindRow[],
  ): Promise<void> {
    // One transaction so the global payload and the player decks are never
    // visible out of sync — a half-written rewind would render as a broken deck.
    await db.transaction(async (tx) => {
      const rewindId = await seasonRewindRepository.upsertSeasonRewind(
        seasonId,
        disciplineId,
        payload,
        REWIND_VERSION,
        tx,
      );
      await seasonRewindRepository.upsertPlayerRewindsBatch(rewindId, rows, REWIND_VERSION, tx);
      await seasonRewindRepository.deleteStalePlayerRewinds(
        rewindId,
        rows.map((row) => row.playerId),
        tx,
      );
    });
  }

  private buildContext(
    season: Awaited<ReturnType<typeof rankedSeasonRepository.getSeasonWithConfig>>,
    players: Awaited<ReturnType<typeof playerMmrRepository.getBySeasonOrdered>>,
  ): SeasonContext {
    const directory: Directory = new Map();
    const tierByPlayer = new Map<string, { name: string; level: number }>();
    const tiers = [...(season!.rankTiers ?? [])].sort((a, b) => b.minMmr - a.minMmr);

    for (const entry of players) {
      if (!entry.player) continue;
      directory.set(entry.playerId, {
        playerId: entry.playerId,
        displayName: entry.player.displayName,
        shortName: entry.player.shortName,
      });
      const tier = tiers.find((candidate) => entry.currentMmr >= candidate.minMmr);
      if (tier) tierByPlayer.set(entry.playerId, { name: tier.name, level: tier.level });
    }

    const totalMmr = players.reduce((sum, entry) => sum + entry.currentMmr, 0);
    return {
      info: {
        seasonId: season!.id,
        name: season!.name,
        disciplineName: season!.discipline?.name ?? null,
        startDate: new Date(season!.startDate),
        endDate: new Date(season!.endDate),
      },
      disciplineId: season!.disciplineId ?? null,
      directory,
      finalRanking: players.map((entry) => entry.playerId),
      tierByPlayer,
      averageMmr: players.length > 0 ? Math.round(totalMmr / players.length) : 0,
    };
  }

  private buildSeasonPayload(
    context: SeasonContext,
    aggregates: PlayerAggregate[],
    replay: ReturnType<typeof replaySeason>,
  ): SeasonRewindPayload {
    return {
      version: REWIND_VERSION,
      season: context.info,
      totals: {
        playerCount: context.directory.size,
        matchCount: replay.matchCount,
        averageMmr: context.averageMmr,
      },
      performance: computePerformanceAwards(aggregates, context.directory, context.finalRanking),
      combat: computeCombatAwards(aggregates, context.directory, replay.rivalries),
      endurance: computeEnduranceAwards(aggregates, context.directory),
      cooperation: computeCooperationAwards(aggregates, context.directory, replay.duos),
    };
  }

  private buildPlayerPayload(
    agg: PlayerAggregate,
    aggregates: PlayerAggregate[],
    replay: ReturnType<typeof replaySeason>,
    context: SeasonContext,
    seasonPayload: SeasonRewindPayload,
    extras: { badges: BadgeRow[]; nextSeason: RewindConclusion["nextSeason"] },
  ): PlayerRewindPayload {
    const rank = context.finalRanking.indexOf(agg.playerId) + 1;
    const tier = context.tierByPlayer.get(agg.playerId) ?? null;
    const relations = this.buildRelations(agg.playerId, replay, context.directory);

    return {
      version: REWIND_VERSION,
      player: context.directory.get(agg.playerId)!,
      finalRank: {
        rank: rank > 0 ? rank : context.finalRanking.length,
        totalPlayers: context.finalRanking.length,
        mmr: agg.finalMmr,
        tierName: tier?.name ?? null,
        tierLevel: tier?.level ?? null,
      },
      totals: {
        matchesPlayed: agg.matchesPlayed,
        wins: agg.wins,
        losses: agg.losses,
        draws: agg.draws,
        winRate:
          agg.matchesPlayed > 0 ? Math.round((agg.wins / agg.matchesPlayed) * 100) : 0,
      },
      journey: {
        initialMmr: agg.initialMmr,
        finalMmr: agg.finalMmr,
        netDelta: agg.finalMmr - agg.initialMmr,
        points: agg.points,
      },
      bestRank: {
        bestRank: agg.bestRank === Number.MAX_SAFE_INTEGER ? rank : agg.bestRank,
        matchesInTop1: agg.matchesInTop1,
        matchesInTop3: agg.matchesInTop3,
        matchesInTop5: agg.matchesInTop5,
      },
      peak: {
        mmr: agg.peakMmr,
        matchId: agg.peakMatchId,
        playedAt: agg.peakPlayedAt,
      },
      streaks: {
        bestWinStreak: agg.bestWinStreak,
        bestUnbeatenStreak: agg.bestUnbeatenStreak,
        worstLossStreak: agg.worstLossStreak,
      },
      feats: {
        biggestUpsetWin: this.hydrateFeat(agg.biggestUpsetWin, context.directory),
        biggestUpsetGap: this.hydrateFeat(agg.biggestUpsetGap, context.directory),
        giantKillerWins: agg.giantKillerWins,
        ...relations,
      },
      badges: extras.badges.map(toClientBadge),
      percentiles: computePercentiles(aggregates, agg),
      conclusion: { nextSeason: extras.nextSeason },
      awardsWon: awardsWonBy(agg.playerId, seasonPayload),
    };
  }

  private hydrateFeat(feat: FeatDraft | null, directory: Directory): RewindFeatMatch | null {
    if (!feat) return null;
    return {
      matchId: feat.matchId,
      playedAt: feat.playedAt,
      opponent: feat.opponentId ? (directory.get(feat.opponentId) ?? null) : null,
      mmrDelta: feat.mmrDelta,
      mmrGap: feat.mmrGap,
    };
  }

  /**
   * Best partner, most faced opponent and nemesis, ranked exactly like the
   * player-stats page does it — weighted by sample size so one lucky evening
   * never outranks a season-long record.
   */
  private buildRelations(
    playerId: string,
    replay: ReturnType<typeof replaySeason>,
    directory: Directory,
  ): Pick<PlayerRewindPayload["feats"], "bestPartner" | "mostFacedOpponent" | "nemesis"> {
    const partners = toRelationStats(playerId, replay.duos, directory);
    const opponents = toRelationStats(playerId, replay.rivalries, directory);

    const mostFaced = [...opponents].sort(
      (a, b) => b.count - a.count || (a.playerId < b.playerId ? -1 : 1),
    );

    return {
      bestPartner: rankRelationsByWeightedRate(partners, (p) => p.wins / p.count)[0] ?? null,
      mostFacedOpponent: mostFaced[0] ?? null,
      nemesis: rankRelationsByWeightedRate(opponents, (o) => o.losses / o.count)[0] ?? null,
    };
  }

  private async findNextSeason(
    disciplineId: string | null,
    currentSeasonId: string,
  ): Promise<RewindConclusion["nextSeason"]> {
    if (!disciplineId) return null;
    const next = await rankedSeasonRepository.getActiveSeasonByDiscipline(disciplineId);
    if (!next || next.id === currentSeasonId) return null;
    return { id: next.id, name: next.name, startDate: new Date(next.startDate) };
  }

  // ============================================
  // Read paths
  // ============================================

  async getBundle(seasonId: string, playerId: string | null): Promise<RewindBundle> {
    const rewind = await seasonRewindRepository.getSeasonRewind(seasonId);
    if (!rewind) throw new NotFoundError(ErrorCode.REWIND_NOT_FOUND);

    const player = playerId
      ? await seasonRewindRepository.getPlayerRewind(seasonId, playerId)
      : null;
    if (!player) return { season: rewind.payload, player: null };

    // The one field that legitimately changes after the snapshot is taken: a new
    // season is usually opened *after* the previous one closes, so the stored
    // value would tell every player forever that nothing is coming next.
    const nextSeason = await this.findNextSeason(rewind.disciplineId, seasonId);

    return {
      season: rewind.payload,
      player: { ...player.payload, conclusion: { nextSeason } },
    };
  }

  markOpened(seasonId: string, playerId: string): Promise<void> {
    return seasonRewindRepository.markOpened(seasonId, playerId);
  }

  markViewed(seasonId: string, playerId: string): Promise<void> {
    return seasonRewindRepository.markViewed(seasonId, playerId);
  }

  listArchive(playerId: string): Promise<RewindArchiveEntry[]> {
    return seasonRewindRepository.listForPlayer(playerId);
  }

  getPromoted(playerId: string): Promise<RewindPromotion | null> {
    return seasonRewindRepository.getPromotedForPlayer(playerId);
  }
}

/** Turns the replay's unordered pair tallies into stats seen from one player. */
function toRelationStats(
  playerId: string,
  tallies: PairTally[],
  directory: Directory,
): PlayerRelationStat[] {
  const stats: PlayerRelationStat[] = [];

  for (const tally of tallies) {
    if (tally.aId !== playerId && tally.bId !== playerId) continue;
    const isA = tally.aId === playerId;
    const other = directory.get(isA ? tally.bId : tally.aId);
    if (!other) continue;

    const wins = isA ? tally.aWins : tally.aLosses;
    const losses = isA ? tally.aLosses : tally.aWins;
    stats.push({
      playerId: other.playerId,
      displayName: other.displayName,
      shortName: other.shortName,
      count: tally.matches,
      wins,
      losses,
      winRate: tally.matches > 0 ? Math.round((wins / tally.matches) * 100) : 0,
    });
  }
  return stats;
}

function toClientBadge(row: BadgeRow): ClientPlayerBadge {
  const action = row.rule.action as RuleAction;
  const badge =
    action.type === "badge"
      ? action
      : { icon: "", label: row.rule.name, description: "" };

  return {
    id: row.id,
    playerId: row.playerId,
    ruleId: row.ruleId,
    icon: badge.icon,
    label: badge.label,
    description: badge.description,
    awardedAt: row.awardedAt,
    matchId: row.matchId,
  };
}

export const seasonRewindService = new SeasonRewindService();
