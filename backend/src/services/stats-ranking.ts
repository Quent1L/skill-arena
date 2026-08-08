/** Minimum sample size before a rate is considered trustworthy enough to rank. */
export const MIN_WEIGHTED_RATE_MATCHES = 3;

/** How many entries a weighted-rate ranking keeps. */
export const TOP_WEIGHTED_RATE = 3;

/**
 * Weighted rates are floating point, so two mathematically equal scores can
 * differ in their last bits. Comparing them exactly would send such a pair to
 * the tie-break only by luck.
 */
export const SCORE_EPSILON = 1e-9;

/**
 * Ranks entries by success rate weighted by sample size (rate × √matches), so a single
 * lucky match never outranks a long, consistently good record. Entries below minMatches
 * are dropped entirely rather than advertising a statistic nobody should trust.
 *
 * Pass minMatches = 0 to rank without the threshold — used as a fallback when the
 * threshold would leave the list empty and showing nothing is worse than showing a
 * clearly labelled small sample.
 *
 * `breakTie` separates entries the rate and the sample size cannot. Without it the
 * winner is decided by the order the entries happened to be built in, which is
 * reproducible but explicable to nobody.
 */
export function rankByWeightedRate<T>(
  items: T[],
  rateOf: (item: T) => number,
  countOf: (item: T) => number,
  minMatches: number = MIN_WEIGHTED_RATE_MATCHES,
  breakTie: (a: T, b: T) => number = () => 0,
  limit: number = TOP_WEIGHTED_RATE,
): T[] {
  return items
    .filter((item) => countOf(item) >= minMatches)
    .map((item) => ({ item, score: rateOf(item) * Math.sqrt(countOf(item)) }))
    .sort(
      (a, b) =>
        (Math.abs(a.score - b.score) > SCORE_EPSILON ? b.score - a.score : 0) ||
        countOf(b.item) - countOf(a.item) ||
        breakTie(a.item, b.item),
    )
    .slice(0, limit)
    .map((s) => s.item);
}

/**
 * The same ranking, but never empty-handed: a tournament whose players have not
 * yet reached the threshold gets the unfiltered ranking rather than a blank
 * card. Callers show the sample size next to each rate, so a small one is
 * visible rather than hidden — which is the whole point of not dropping it.
 */
export function rankByWeightedRateOrFallback<T>(
  items: T[],
  rateOf: (item: T) => number,
  countOf: (item: T) => number,
  breakTie: (a: T, b: T) => number = () => 0,
  limit: number = TOP_WEIGHTED_RATE,
): T[] {
  const ranked = rankByWeightedRate(
    items,
    rateOf,
    countOf,
    MIN_WEIGHTED_RATE_MATCHES,
    breakTie,
    limit,
  );
  if (ranked.length > 0) return ranked;
  return rankByWeightedRate(items, rateOf, countOf, 0, breakTie, limit);
}
