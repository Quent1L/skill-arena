import type { TeamInteractionMode } from "@skol-arena/shared";

/**
 * Pure MMR engine — no DB access, no side effects. Every MMR path (finalization,
 * provisional match preview, provisional leaderboard replay) calls this and this
 * only; they differ solely by the MMR snapshot they feed in.
 *
 * The engine separates two concerns the previous implementation mixed together:
 *
 *   1. How expected the result was  → Elo on side averages → one team delta.
 *   2. Who carries which part of it → teamInteractionMode  → per-player shares.
 *
 * A match therefore transfers MMR between the two sides instead of creating it.
 * Two documented exceptions to that invariant remain: the per-player placement
 * multiplier, and the MMR floor at 1.
 */

/**
 * Bumped whenever a change to this file makes previously stored MMR
 * incomparable with what a new match would produce. Seasons still running are
 * replayed at boot to catch up — see `utils/init-mmr-engine.ts`.
 *
 * 1 — per-player ratio applied directly to the delta (non-conservative)
 * 2 — team delta split into normalised shares
 */
export const MMR_ENGINE_VERSION = 2;

export type MatchResult = 1 | 0 | 0.5;

export interface EnginePlayer {
  id: string;
  mmr: number;
  isPlacement: boolean;
}

export interface EngineSide {
  players: EnginePlayer[];
  score: number | null;
  /** The side's Elo result: 1 win, 0 loss, 0.5 draw. */
  result: MatchResult;
}

export interface MatchMmrInput {
  sides: [EngineSide, EngineSide];
  kFactor: number;
  scoreCountsForMmr: boolean;
  mmrMultiplier: number;
  teamInteractionMode: TeamInteractionMode;
}

export interface PlayerMmrDelta {
  playerId: string;
  mmrDelta: number;
  newMmr: number;
  /** Normalised share of the team delta, before the placement multiplier. */
  share: number;
  /** K of the match, doubled when this player is in placement. */
  kEffective: number;
}

/** Bounds of the relative-level ratio used to weight a player's share. */
export const WEIGHT_CLAMP_MIN = 0.75;
export const WEIGHT_CLAMP_MAX = 1.25;

/**
 * How strongly a player's level modulates their share of the team delta.
 * 0 = strictly equal split. The exponent is negated on a losing side in
 * INDIVIDUAL mode, which is what makes the stronger player pay for the defeat.
 */
export const MODE_ALPHA: Record<TeamInteractionMode, number> = {
  COLLABORATIVE: 0,
  SHARED_RESOURCE: 0.5,
  INDIVIDUAL: 1,
};

export const PLACEMENT_MULTIPLIER = 2;
export const DEFAULT_TEAM_INTERACTION_MODE: TeamInteractionMode = "COLLABORATIVE";
export const MIN_MMR = 1;

export function calculateExpectedScore(playerMmr: number, opponentMmr: number): number {
  return 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
}

/**
 * Score amplification, in [1, 2]: a blowout moves twice as much MMR as a match
 * settled by a hair. Driven by the gap, not by who won — both sides share it.
 */
export function calculateScoreMultiplier(scoreA: number, scoreB: number): number {
  const total = scoreA + scoreB;
  if (total <= 0) return 1;
  return 1 + Math.abs(scoreA - scoreB) / total;
}

function sideAvgMmr(side: EngineSide): number {
  const total = side.players.reduce((sum, p) => sum + Math.max(MIN_MMR, p.mmr), 0);
  return total / side.players.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalised shares of one side, summing to exactly 1 whatever the weights are.
 * A solo side always gets a share of 1, which is why the interaction mode has no
 * effect on a 1v1 — no branch needed for it.
 */
function playerShares(
  side: EngineSide,
  oppAvgMmr: number,
  mode: TeamInteractionMode,
  teamDelta: number,
): number[] {
  const alpha = MODE_ALPHA[mode] ?? MODE_ALPHA.COLLABORATIVE;
  const sign = mode === "INDIVIDUAL" && teamDelta < 0 ? -1 : 1;
  const exponent = alpha * sign;

  const weights = side.players.map((p) => {
    const ratio = clamp(oppAvgMmr / Math.max(MIN_MMR, p.mmr), WEIGHT_CLAMP_MIN, WEIGHT_CLAMP_MAX);
    return Math.pow(ratio, exponent);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return side.players.map(() => 1 / side.players.length);
  return weights.map((w) => w / total);
}

/**
 * Splits an integer target across shares with the largest-remainder method, so
 * the parts sum back to the target exactly. Remainder ties break on playerId,
 * never on input order — the deterministic season replay depends on that.
 *
 * `target` must already be an integer: the caller rounds side A's team delta and
 * negates it for side B, because `Math.round` is not symmetric on halves
 * (`round(2.5) = 3` but `round(-2.5) = -2`) and would leak a point per match.
 */
function allocateIntegerDeltas(target: number, shares: number[], playerIds: string[]): number[] {
  const sign = target < 0 ? -1 : 1;
  const magnitude = Math.abs(target);
  const exact = shares.map((share) => magnitude * share);
  const base = exact.map((value) => Math.floor(value));

  let leftover = magnitude - base.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - base[index] }))
    .sort((a, b) =>
      b.remainder - a.remainder || playerIds[a.index].localeCompare(playerIds[b.index]),
    );

  for (const { index } of order) {
    if (leftover <= 0) break;
    base[index] += 1;
    leftover -= 1;
  }

  return base.map((value) => sign * value);
}

function zeroDeltas(sides: [EngineSide, EngineSide]): PlayerMmrDelta[] {
  return [...sides[0].players, ...sides[1].players].map((p) => ({
    playerId: p.id,
    mmrDelta: 0,
    newMmr: p.mmr,
    share: 0,
    kEffective: 0,
  }));
}

function buildSideResults(
  side: EngineSide,
  teamDelta: number,
  oppAvgMmr: number,
  mode: TeamInteractionMode,
  kEffective: number,
): PlayerMmrDelta[] {
  const shares = playerShares(side, oppAvgMmr, mode, teamDelta);
  const playerIds = side.players.map((p) => p.id);
  const deltas = allocateIntegerDeltas(teamDelta, shares, playerIds);

  return side.players.map((player, index) => {
    // Placement is applied after the allocation: a rookie converges twice as
    // fast without doubling what their opponents risk. This is the engine's one
    // deliberate breach of conservation, bounded by placementMatches × K.
    const raw = deltas[index] * (player.isPlacement ? PLACEMENT_MULTIPLIER : 1);
    const newMmr = Math.max(MIN_MMR, player.mmr + raw);
    return {
      playerId: player.id,
      mmrDelta: newMmr - player.mmr,
      newMmr,
      share: shares[index],
      kEffective: kEffective * (player.isPlacement ? PLACEMENT_MULTIPLIER : 1),
    };
  });
}

export function calculateMatchMmr(input: MatchMmrInput): PlayerMmrDelta[] {
  const { sides, kFactor, scoreCountsForMmr, mmrMultiplier, teamInteractionMode } = input;
  const [sideA, sideB] = sides;

  if (!scoreCountsForMmr || sideA.players.length === 0 || sideB.players.length === 0) {
    return zeroDeltas(sides);
  }

  const avgA = sideAvgMmr(sideA);
  const avgB = sideAvgMmr(sideB);
  const expectedA = calculateExpectedScore(avgA, avgB);

  const scoreMultiplier = calculateScoreMultiplier(sideA.score ?? 0, sideB.score ?? 0);
  const kEffective = kFactor * scoreMultiplier * mmrMultiplier;

  // Rounded once, then negated: side B's target is posed rather than recomputed,
  // which is what makes the two sides cancel out exactly.
  const teamDeltaA = Math.round(kEffective * (sideA.result - expectedA));

  return [
    ...buildSideResults(sideA, teamDeltaA, avgB, teamInteractionMode, kEffective),
    ...buildSideResults(sideB, -teamDeltaA, avgA, teamInteractionMode, kEffective),
  ];
}
