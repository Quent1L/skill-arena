// Computes per-side rank + awarded points + match-level winnerSide for matches of any size.
// Rank is the single source of truth; with exactly 2 sides it collapses to a single A/B winner.

import type { StandingsPointsSource } from "@skol-arena/shared";

export interface SideOutcomeInput {
  position: number;
  score?: number | null;
  rank?: number | null;
}

export interface SideOutcomeResult {
  position: number;
  score: number | null;
  rank: number;
  pointsAwarded: number;
}

export interface PointsConfig {
  pointPerVictory: number | null;
  pointPerDraw: number | null;
  pointPerLoss: number | null;
  standingsPointsSource: StandingsPointsSource | null;
  rankPoints: number[] | null;
}

export interface MatchOutcome {
  sides: SideOutcomeResult[];
  winnerSide: "A" | "B" | null;
}

/**
 * Assign competition ranks (1 = best) from a list of sides.
 * Priority: explicit per-side rank → winnerPosition (2-side winner pick) → scores (desc) → all tied.
 * Ties share a rank ("1224" style).
 */
export function resolveRanks(
  sides: SideOutcomeInput[],
  winnerPosition?: number | null,
): Map<number, number> {
  const ranks = new Map<number, number>();

  if (sides.every((s) => s.rank != null)) {
    for (const s of sides) ranks.set(s.position, s.rank as number);
    return ranks;
  }

  if (winnerPosition !== undefined) {
    // explicit: null = draw (all rank 1), otherwise the named position wins
    for (const s of sides) {
      const isWinner = winnerPosition === null || s.position === winnerPosition;
      ranks.set(s.position, isWinner ? 1 : 2);
    }
    return ranks;
  }

  if (sides.some((s) => s.score != null)) {
    const sorted = [...sides].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    let rank = 0;
    let prevScore: number | null = null;
    sorted.forEach((s, i) => {
      const score = s.score ?? 0;
      if (prevScore === null || score !== prevScore) rank = i + 1;
      ranks.set(s.position, rank);
      prevScore = score;
    });
    return ranks;
  }

  for (const s of sides) ranks.set(s.position, 1); // no signal → everyone draws
  return ranks;
}

function pointsForSide(
  rank: number,
  isSoleLeader: boolean,
  sharesLead: boolean,
  score: number | null,
  cfg: PointsConfig,
): number {
  const win = cfg.pointPerVictory ?? 3;
  const draw = cfg.pointPerDraw ?? 1;
  const loss = cfg.pointPerLoss ?? 0;
  const source = cfg.standingsPointsSource ?? "match_result";

  if (source === "score") return score ?? 0;
  if (source === "rank") {
    const table = cfg.rankPoints;
    if (table && table.length > 0) return table[rank - 1] ?? table[table.length - 1] ?? 0;
    return rank === 1 ? win : loss; // fallback when no table configured
  }
  // match_result
  if (sharesLead) return draw;
  if (isSoleLeader) return win;
  return loss;
}

export function computeMatchOutcome(
  sides: SideOutcomeInput[],
  cfg: PointsConfig,
  winnerPosition?: number | null,
): MatchOutcome {
  const ranks = resolveRanks(sides, winnerPosition);
  const leadersAtRank1 = sides.filter((s) => ranks.get(s.position) === 1).length;

  const results: SideOutcomeResult[] = sides.map((s) => {
    const rank = ranks.get(s.position) ?? 1;
    const sharesLead = rank === 1 && leadersAtRank1 > 1;
    const isSoleLeader = rank === 1 && leadersAtRank1 === 1;
    return {
      position: s.position,
      score: s.score ?? null,
      rank,
      pointsAwarded: pointsForSide(rank, isSoleLeader, sharesLead, s.score ?? null, cfg),
    };
  });

  return { sides: results, winnerSide: deriveWinnerSide(ranks) };
}

/** winnerSide (A/B) is only meaningful for exactly 2 sides; null otherwise. */
function deriveWinnerSide(ranks: Map<number, number>): "A" | "B" | null {
  if (ranks.size !== 2) return null;
  const r1 = ranks.get(1);
  const r2 = ranks.get(2);
  if (r1 == null || r2 == null || r1 === r2) return null;
  return r1 < r2 ? "A" : "B";
}

/** Map the stored 2-side A/B winner to a side position (A → 1, B → 2, draw/null → null). */
export function winnerSideToPosition(winnerSide: string | null): number | null {
  if (winnerSide === "A") return 1;
  if (winnerSide === "B") return 2;
  return null;
}

/** Classify a side's rank into win/draw/loss. Draw = it shares rank 1 with another side. */
export function classifyRank(
  rank: number | undefined,
  rank1Count: number,
): { isWin: boolean; isDraw: boolean } {
  return { isWin: rank === 1 && rank1Count === 1, isDraw: rank === 1 && rank1Count > 1 };
}

/**
 * Resolve per-side ranks plus the number of sides sharing rank 1, in one pass.
 * Reads per-side rank when present, else derives from winnerPosition (see resolveRanks).
 */
export function resolveRankInfo(
  sides: SideOutcomeInput[],
  winnerPosition?: number | null,
): { rankByPosition: Map<number, number>; rank1Count: number } {
  const rankByPosition = resolveRanks(sides, winnerPosition);
  const rank1Count = Array.from(rankByPosition.values()).filter((r) => r === 1).length;
  return { rankByPosition, rank1Count };
}
