/**
 * The scalar half of the MMR engine: the two formulas that price a match from
 * side averages, and the floor they rest on. Kept in shared because the client
 * needs them too — the match wizard previews the balance of a line-up before it
 * is submitted, and it must answer to the exact same arithmetic as the server.
 *
 * Everything that needs DB state or produces per-player deltas stays in
 * `backend/src/services/mmr-engine.ts`, which re-exports this module.
 */

/** No player is ever priced below this, and no average is built on less. */
export const MIN_MMR = 1;

/**
 * A side's MMR, as the engine sees it: the arithmetic mean of its players, each
 * floored at `MIN_MMR` first so a corrupt or negative record cannot drag the
 * whole side under.
 */
export function averageMmr(mmrs: number[]): number {
  if (mmrs.length === 0) return MIN_MMR;
  const total = mmrs.reduce((sum, mmr) => sum + Math.max(MIN_MMR, mmr), 0);
  return total / mmrs.length;
}

/**
 * Classic Elo, base 10, divisor 400: the probability that `playerMmr` beats
 * `opponentMmr`. Fed side averages, it is the match's win probability.
 */
export function calculateExpectedScore(playerMmr: number, opponentMmr: number): number {
  return 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / 400));
}
