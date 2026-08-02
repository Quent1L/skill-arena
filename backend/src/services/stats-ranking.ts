/** Minimum sample size before a rate is considered trustworthy enough to rank. */
export const MIN_WEIGHTED_RATE_MATCHES = 3;

/** How many entries a weighted-rate ranking keeps. */
export const TOP_WEIGHTED_RATE = 3;

/**
 * Ranks entries by success rate weighted by sample size (rate × √matches), so a single
 * lucky match never outranks a long, consistently good record. Entries below minMatches
 * are dropped entirely rather than advertising a statistic nobody should trust.
 *
 * Pass minMatches = 0 to rank without the threshold — used as a fallback when the
 * threshold would leave the list empty and showing nothing is worse than showing a
 * clearly labelled small sample.
 */
export function rankByWeightedRate<T>(
  items: T[],
  rateOf: (item: T) => number,
  countOf: (item: T) => number,
  minMatches: number = MIN_WEIGHTED_RATE_MATCHES,
): T[] {
  return items
    .filter((item) => countOf(item) >= minMatches)
    .map((item) => ({ item, score: rateOf(item) * Math.sqrt(countOf(item)) }))
    .sort((a, b) => b.score - a.score || countOf(b.item) - countOf(a.item))
    .slice(0, TOP_WEIGHTED_RATE)
    .map((s) => s.item);
}
