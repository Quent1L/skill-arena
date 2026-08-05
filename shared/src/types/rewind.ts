import type { MmrChartPoint } from "./ranked";
import type { ClientPlayerBadge } from "./rules-engine";
import type { PlayerRelationStat } from "./player";

// ============================================
// Season Rewind — end-of-season recap
// ============================================

/**
 * Payload format version. Bump it whenever the shape of a rewind payload changes:
 * stored rewinds with a lower version are regenerated instead of being rendered
 * against a structure they were never built for.
 */
export const REWIND_VERSION = 1;

/** How long a freshly generated rewind stays promoted on the home page. */
export const REWIND_PROMO_DAYS = 14;

/** Minimum matches required to be eligible for the corresponding award. */
export const REWIND_MIN_MATCHES_SNIPER = 30;
export const REWIND_MIN_MATCHES_DUO = 10;
export const REWIND_MIN_MATCHES_RIVALRY = 5;
export const REWIND_MIN_MATCHES_NEMESIS = 5;

/** A rewind covers a single season today; 'year' is reserved for cross-season recaps. */
export type RewindScope = "season" | "year";

export interface RewindPlayerRef {
  playerId: string;
  displayName: string;
  shortName: string;
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
  /** Largest MMR gap overturned in a single win. `value` = the gap. */
  biggestUpset: RewindDatedAward | null;
  /** Most wins against a higher-rated opponent. `value` = that count. */
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
  tierName: string | null;
  tierLevel: number | null;
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
}

export interface RewindStreaks {
  bestWinStreak: number;
  bestUnbeatenStreak: number;
  worstLossStreak: number;
}

/** A single match worth telling a story about. */
export interface RewindFeatMatch {
  matchId: string;
  playedAt: Date;
  opponent: RewindPlayerRef | null;
  mmrDelta: number;
  /** How much stronger the opposition was, in MMR, before the match. */
  mmrGap: number;
}

export interface RewindFeats {
  /** Win against a stronger opponent that paid the most MMR. */
  biggestUpsetWin: RewindFeatMatch | null;
  /** Win against the largest MMR gap, whatever it paid. */
  biggestUpsetGap: RewindFeatMatch | null;
  giantKillerWins: number;
  bestPartner: PlayerRelationStat | null;
  mostFacedOpponent: PlayerRelationStat | null;
  nemesis: PlayerRelationStat | null;
}

/**
 * Where the player sits in the season, as a "top X %" figure — lower is better.
 * A value of 5 means the player is in the top 5 % on that metric.
 */
export interface RewindPercentiles {
  matchesPlayed: number;
  winRate: number;
  progression: number;
  winStreak: number;
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
