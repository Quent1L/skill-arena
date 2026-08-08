import type { CompetitionRank } from '@skol-arena/shared/types/index'

/**
 * Competition ranks (1,1,1,4) for a list the caller has already sorted. Mirrors
 * `assignCompetitionRanks` in backend/src/services/stats-ranking.ts, for the leaderboards
 * whose ranking is a pure function of a value the client already holds — anything ranked
 * on criteria the client cannot recompute gets its rank from the payload instead.
 */
export function assignCompetitionRanks<T>(
  sorted: T[],
  valueOf: (item: T) => number,
): (CompetitionRank & { item: T })[] {
  const ranked: (CompetitionRank & { item: T })[] = []
  let start = 0

  while (start < sorted.length) {
    let end = start + 1
    while (end < sorted.length && valueOf(sorted[end]!) === valueOf(sorted[start]!)) end++
    for (let i = start; i < end; i++) {
      ranked.push({ item: sorted[i]!, rank: start + 1, tiedCount: end - start })
    }
    start = end
  }

  return ranked
}
