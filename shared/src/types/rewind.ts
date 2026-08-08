import type { MmrChartPoint } from "./ranked";
import type { ClientPlayerBadge } from "./rules-engine";
import type { PlayerRelationStat } from "./player";

// ============================================
// Season Rewind — end-of-season recap
// ============================================

/**
 * Format version of the payloads this build produces.
 *
 * A rewind is a souvenir, not a report: the deck a player watched in 2026 must
 * still be that same deck in 2030. So a stored rewind is frozen at the version
 * that produced it — the generator refuses to touch a season whose stored
 * version is not this one, and the client renders only the cards that version
 * knew about (see the `since` field on the card registry).
 *
 * Bump this **only when the payload shape changes** — a new field, a card that
 * needs data the old payloads do not carry. Bumping is irreversible in practice:
 * every rewind already stored stops being regenerated from that moment on, so
 * any fix to the numbers has to ship *before* the bump that freezes them.
 * Changing how a figure is computed, without changing the shape, is not a
 * version bump: it is a fix that existing rewinds should receive.
 */
export const REWIND_VERSION = 1;

/**
 * How many points a stored MMR journey keeps. The curve is a 160px sparkline
 * with no visible markers: past a couple hundred points the extra resolution is
 * not rendered, it is only stored and shipped. A season regular can play a
 * thousand ranked matches, so the raw series is downsampled on write.
 */
export const REWIND_MAX_CHART_POINTS = 200;

/** How long a freshly generated rewind stays promoted on the home page. */
export const REWIND_PROMO_DAYS = 14;

/** Minimum matches required to be eligible for the corresponding award. */
export const REWIND_MIN_MATCHES_SNIPER = 20;
export const REWIND_MIN_MATCHES_DUO = 10;
export const REWIND_MIN_MATCHES_RIVALRY = 5;
export const REWIND_MIN_MATCHES_NEMESIS = 5;

/**
 * Minimum matches to enter the pool a rate percentile is measured against. Rate
 * metrics are meaningless at one match — a single win is a 100% win rate — and
 * one such player shifts every regular down a band. The sniper threshold is
 * reused so "top X% on win rate" and "best win rate of the season" answer to the
 * same population.
 */
export const REWIND_MIN_MATCHES_PERCENTILE = REWIND_MIN_MATCHES_SNIPER;

/** A rewind covers a single season today; 'year' is reserved for cross-season recaps. */
export type RewindScope = "season" | "year";

export interface RewindPlayerRef {
  playerId: string;
  displayName: string;
  shortName: string;
}

/** The rank tier a figure lands in, carried with everything a badge needs to draw itself. */
export interface RewindTierRef {
  name: string;
  level: number;
  /** Per-season override; the client falls back on its own icon table by level. */
  iconClass: string | null;
}

/**
 * How many players stood on each side of a match. An MMR gap only means
 * something next to the format it was taken in: in 2v2 the "opposition" is a
 * team average, not a single player.
 */
export interface RewindMatchFormat {
  teamSize: number;
  opponentTeamSize: number;
}

// ============================================
// Global awards
// ============================================

/**
 * Every award the season hands out. Used as a discriminator so a player payload
 * can flag which ones it won without duplicating the award data.
 */
export type RewindAwardKey =
  | "king"
  | "peakMmr"
  | "progression"
  | "sniper"
  | "biggestUpset"
  | "giantKiller"
  | "leaderHunter"
  | "rivalry"
  | "nemesis"
  | "marathon"
  | "topOneKing"
  | "topThreeKing"
  | "topFiveKing"
  | "longestStreak"
  | "duo"
  | "bestPartner";

export interface RewindAward {
  player: RewindPlayerRef;
  /** The metric the award ranks on — meaning depends on the award. */
  value: number;
  /** Contextual figure shown next to the value (usually matches played). */
  detail?: number | null;
}

/** An award earned in a single identified match rather than over a cumulative total. */
export interface RewindDatedAward extends RewindAward {
  matchId: string;
  playedAt: Date;
  opponent?: RewindPlayerRef | null;
  /** Set on awards where the format changes how the value reads, null elsewhere. */
  format?: RewindMatchFormat | null;
}

/** An award held by a pair playing together. */
export interface RewindDuoAward {
  players: [RewindPlayerRef, RewindPlayerRef];
  matchesTogether: number;
  wins: number;
  /** Win rate in percent (0-100), already rounded. */
  winRate: number;
}

/** An award held by a pair facing each other. Record is from `players[0]`'s point of view. */
export interface RewindPairAward {
  players: [RewindPlayerRef, RewindPlayerRef];
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Every award is nullable: a season with no eligible candidate simply drops the line. */
export interface RewindPerformanceAwards {
  /** Finished first. `value` = final MMR. */
  king: RewindAward | null;
  /** Highest MMR reached at any point. `value` = that MMR. */
  peakMmr: RewindDatedAward | null;
  /** Largest net MMR gain over the season. `value` = the gain. */
  progression: RewindAward | null;
  /** Best win rate over REWIND_MIN_MATCHES_SNIPER matches. `value` = win rate (0-100). */
  sniper: RewindAward | null;
}

export interface RewindCombatAwards {
  /** Largest MMR gap between the two sides overturned in a single win. `value` = the gap. */
  biggestUpset: RewindDatedAward | null;
  /**
   * Most wins against an opposition rated more than STRONGER_OPPONENT_MMR_GAP
   * above their own side. `value` = that count.
   */
  giantKiller: RewindAward | null;
  /** Most wins against whoever was ranked #1 at the time. `value` = that count. */
  leaderHunter: RewindAward | null;
  /** Most played duel of the season. */
  rivalry: RewindPairAward | null;
  /** Player against whom the most others hold a losing record. `value` = that head count. */
  nemesis: RewindAward | null;
}

export interface RewindEnduranceAwards {
  /** Most matches played. `value` = that count. */
  marathon: RewindAward | null;
  /** Most matches spent ranked #1 — measured in matches, never in days. */
  topOneKing: RewindAward | null;
  /** Most matches spent in the top 3. */
  topThreeKing: RewindAward | null;
  /** Most matches spent in the top 5. */
  topFiveKing: RewindAward | null;
  /** Longest run of consecutive wins. `value` = its length. */
  longestStreak: RewindAward | null;
}

export interface RewindCooperationAwards {
  /** Best win ratio as a pair over REWIND_MIN_MATCHES_DUO matches together. */
  duo: RewindDuoAward | null;
  /** Player with whom the most others hold a winning record. `value` = that head count. */
  bestPartner: RewindAward | null;
}

export interface RewindSeasonInfo {
  seasonId: string;
  name: string;
  disciplineName: string | null;
  startDate: Date;
  endDate: Date;
  /**
   * Whether the season ever produced a draw. A discipline without draws would
   * otherwise be shown a "0 draws" tile and an unbeaten streak that can only
   * repeat the win streak.
   */
  allowDraw: boolean;
}

export interface RewindSeasonTotals {
  playerCount: number;
  matchCount: number;
  averageMmr: number;
}

export interface SeasonRewindPayload {
  version: number;
  season: RewindSeasonInfo;
  totals: RewindSeasonTotals;
  performance: RewindPerformanceAwards;
  combat: RewindCombatAwards;
  endurance: RewindEnduranceAwards;
  cooperation: RewindCooperationAwards;
}

// ============================================
// Per-player payload
// ============================================

export interface RewindFinalRank {
  rank: number;
  totalPlayers: number;
  mmr: number;
  tier: RewindTierRef | null;
}

export interface RewindTotals {
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** Win rate in percent (0-100), already rounded. */
  winRate: number;
}

export interface RewindMmrJourney {
  initialMmr: number;
  finalMmr: number;
  netDelta: number;
  points: MmrChartPoint[];
}

export interface RewindBestRank {
  bestRank: number;
  matchesInTop1: number;
  matchesInTop3: number;
  matchesInTop5: number;
}

export interface RewindPeak {
  mmr: number;
  /** Null when the player never climbed above their starting MMR. */
  matchId: string | null;
  playedAt: Date | null;
  /** Tier that peak MMR sat in — not necessarily the one the season ended on. */
  tier: RewindTierRef | null;
}

export interface RewindStreaks {
  bestWinStreak: number;
  /** MMR banked over that run. Two runs of equal length rarely pay the same. */
  bestWinStreakMmr: number;
  bestUnbeatenStreak: number;
  worstLossStreak: number;
  /** MMR dropped over that run, negative. */
  worstLossStreakMmr: number;
}

/** A single match worth telling a story about. */
export interface RewindFeatMatch {
  matchId: string;
  playedAt: Date;
  opponent: RewindPlayerRef | null;
  mmrDelta: number;
  /**
   * How much stronger the opposing side was, in MMR, before the match —
   * measured between the two side averages, so a 2v2 gap reads like a 1v1 one.
   */
  mmrGap: number;
  format: RewindMatchFormat;
}

export interface RewindFeats {
  /**
   * The match that paid the most MMR. Not the same as the biggest upset: the MMR
   * gap is only one input, and an outcome type carries its own multiplier.
   */
  bestMmrGain: RewindFeatMatch | null;
  /** Win against the largest MMR gap, whatever it paid. */
  biggestUpsetGap: RewindFeatMatch | null;
  /**
   * Wins where the opposing side averaged more than STRONGER_OPPONENT_MMR_GAP
   * above the player's own side — the same bar as the profile's win rate by
   * opponent level, but measured side against side rather than against a single
   * rating.
   */
  giantKillerWins: number;
  bestPartner: PlayerRelationStat | null;
  mostFacedOpponent: PlayerRelationStat | null;
  nemesis: PlayerRelationStat | null;
}

/**
 * Where the player sits on one metric. The percentage alone is too coarse to
 * mean much in a small league — "top 25 %" of eight players is second place —
 * so the absolute position and the size of the population it was measured
 * against travel with it.
 */
export interface RewindPercentileEntry {
  /** "Top X %", lower is better. A value of 5 means the top 5 % on that metric. */
  topPercent: number;
  /** Absolute position, 1-based. Ties share the best position. */
  rank: number;
  /** How many players the position was taken among — not always the whole season. */
  poolSize: number;
}

export interface RewindPercentiles {
  matchesPlayed: RewindPercentileEntry;
  winRate: RewindPercentileEntry;
  progression: RewindPercentileEntry;
  winStreak: RewindPercentileEntry;
}

export interface RewindConclusion {
  nextSeason: {
    id: string;
    name: string;
    startDate: Date;
  } | null;
}

export interface PlayerRewindPayload {
  version: number;
  player: RewindPlayerRef;
  finalRank: RewindFinalRank;
  totals: RewindTotals;
  journey: RewindMmrJourney;
  bestRank: RewindBestRank;
  peak: RewindPeak | null;
  streaks: RewindStreaks;
  feats: RewindFeats;
  badges: ClientPlayerBadge[];
  percentiles: RewindPercentiles;
  conclusion: RewindConclusion;
  /** Season awards this player holds — drives the highlight on the award cards. */
  awardsWon: RewindAwardKey[];
}

// ============================================
// API responses
// ============================================

export interface RewindBundle {
  season: SeasonRewindPayload;
  player: PlayerRewindPayload | null;
}

export interface RewindArchiveEntry {
  seasonId: string;
  seasonName: string;
  disciplineName: string | null;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  viewedAt: Date | null;
}

/**
 * The rewind currently worth putting in front of the player: generated less than
 * REWIND_PROMO_DAYS ago and not watched through to the end. The server owns this
 * decision entirely — the client never computes the window itself.
 */
export interface RewindPromotion {
  seasonId: string;
  seasonName: string;
  disciplineName: string | null;
  endDate: Date;
  promotedUntil: Date;
  /** Set on first open: the season page only auto-opens the rewind while this is null. */
  openedAt: Date | null;
}

export type RewindReadyEvent = {
  event: "rewind_ready";
  data: { seasonId: string };
};
