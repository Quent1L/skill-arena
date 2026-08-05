import {
  REWIND_MIN_MATCHES_DUO,
  REWIND_MIN_MATCHES_NEMESIS,
  REWIND_MIN_MATCHES_RIVALRY,
  REWIND_MIN_MATCHES_SNIPER,
  type RewindAward,
  type RewindAwardKey,
  type RewindCombatAwards,
  type RewindCooperationAwards,
  type RewindDatedAward,
  type RewindDuoAward,
  type RewindEnduranceAwards,
  type RewindPairAward,
  type RewindPercentiles,
  type RewindPerformanceAwards,
  type RewindPlayerRef,
} from "@skol-arena/shared/types/index";
import type { PairTally, PlayerAggregate } from "./season-rewind.replay";

/**
 * Every award ranks on a single metric, and every tie is broken the same way:
 * more matches first, then the lower player id. Determinism is not cosmetic
 * here — a rewind can be regenerated after an MMR recalculation, and the same
 * data must always crown the same player.
 */
type Directory = Map<string, RewindPlayerRef>;

interface Candidate {
  aggregate: PlayerAggregate;
  value: number;
}

function winRateOf(agg: PlayerAggregate): number {
  if (agg.matchesPlayed === 0) return 0;
  return Math.round((agg.wins / agg.matchesPlayed) * 100);
}

function bestCandidate(candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (candidate.value <= 0) continue;
    if (!best || outranks(candidate, best)) best = candidate;
  }
  return best;
}

function outranks(candidate: Candidate, best: Candidate): boolean {
  if (candidate.value !== best.value) return candidate.value > best.value;
  if (candidate.aggregate.matchesPlayed !== best.aggregate.matchesPlayed) {
    return candidate.aggregate.matchesPlayed > best.aggregate.matchesPlayed;
  }
  return candidate.aggregate.playerId < best.aggregate.playerId;
}

function toAward(
  candidate: Candidate | null,
  directory: Directory,
  detail?: (agg: PlayerAggregate) => number,
): RewindAward | null {
  if (!candidate) return null;
  const player = directory.get(candidate.aggregate.playerId);
  if (!player) return null;
  return {
    player,
    value: candidate.value,
    detail: detail ? detail(candidate.aggregate) : candidate.aggregate.matchesPlayed,
  };
}

/** Ranks players on `valueOf`, keeping only those over `minMatches`. */
function award(
  aggregates: PlayerAggregate[],
  directory: Directory,
  valueOf: (agg: PlayerAggregate) => number,
  options: { minMatches?: number; detail?: (agg: PlayerAggregate) => number } = {},
): RewindAward | null {
  const minMatches = options.minMatches ?? 0;
  const candidates = aggregates
    .filter((agg) => agg.matchesPlayed >= minMatches)
    .map((agg) => ({ aggregate: agg, value: valueOf(agg) }));
  return toAward(bestCandidate(candidates), directory, options.detail);
}

// ============================================
// Performance
// ============================================

function peakAward(aggregates: PlayerAggregate[], directory: Directory): RewindDatedAward | null {
  // Only peaks actually reached through a match qualify: a player who never
  // climbed above their starting MMR has no peak to tell a story about.
  const withMatch = aggregates.filter((agg) => agg.peakMatchId !== null);
  const best = bestCandidate(withMatch.map((agg) => ({ aggregate: agg, value: agg.peakMmr })));
  const base = toAward(best, directory);
  if (!base || !best) return null;
  return {
    ...base,
    matchId: best.aggregate.peakMatchId!,
    playedAt: best.aggregate.peakPlayedAt!,
  };
}

export function computePerformanceAwards(
  aggregates: PlayerAggregate[],
  directory: Directory,
  finalRanking: string[],
): RewindPerformanceAwards {
  const kingId = finalRanking[0];
  const kingAgg = aggregates.find((agg) => agg.playerId === kingId);

  return {
    king:
      kingAgg && directory.has(kingAgg.playerId)
        ? { player: directory.get(kingAgg.playerId)!, value: kingAgg.finalMmr, detail: kingAgg.matchesPlayed }
        : null,
    peakMmr: peakAward(aggregates, directory),
    progression: award(aggregates, directory, (agg) => agg.finalMmr - agg.initialMmr),
    sniper: award(aggregates, directory, winRateOf, {
      minMatches: REWIND_MIN_MATCHES_SNIPER,
    }),
  };
}

// ============================================
// Combat
// ============================================

function upsetAward(aggregates: PlayerAggregate[], directory: Directory): RewindDatedAward | null {
  const withUpset = aggregates.filter((agg) => agg.biggestUpsetGap !== null);
  const best = bestCandidate(
    withUpset.map((agg) => ({ aggregate: agg, value: agg.biggestUpsetGap!.mmrGap })),
  );
  const base = toAward(best, directory);
  if (!base || !best) return null;

  const feat = best.aggregate.biggestUpsetGap!;
  return {
    ...base,
    matchId: feat.matchId,
    playedAt: feat.playedAt,
    opponent: feat.opponentId ? (directory.get(feat.opponentId) ?? null) : null,
  };
}

/** The most played duel of the season, whoever won it. */
export function computeRivalry(
  rivalries: PairTally[],
  directory: Directory,
): RewindPairAward | null {
  let best: PairTally | null = null;
  for (const tally of rivalries) {
    if (tally.matches < REWIND_MIN_MATCHES_RIVALRY) continue;
    if (!best || tally.matches > best.matches || (tally.matches === best.matches && tally.aId < best.aId)) {
      best = tally;
    }
  }
  if (!best) return null;

  const a = directory.get(best.aId);
  const b = directory.get(best.bId);
  if (!a || !b) return null;
  return {
    players: [a, b],
    matchesPlayed: best.matches,
    wins: best.aWins,
    losses: best.aLosses,
    draws: best.draws,
  };
}

/**
 * Counts, for each player, how many opponents hold a losing record against
 * them. This measures reach rather than raw strength: being everyone's problem
 * is a different achievement from beating one person a lot.
 */
export function countNemesisVictims(rivalries: PairTally[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const tally of rivalries) {
    if (tally.matches < REWIND_MIN_MATCHES_NEMESIS) continue;
    if (tally.aWins < tally.aLosses) bump(scores, tally.bId);
    else if (tally.aLosses < tally.aWins) bump(scores, tally.aId);
  }
  return scores;
}

/** Mirror of the nemesis count: with whom do the most players win? */
export function countPartnerFans(duos: PairTally[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const tally of duos) {
    if (tally.matches < REWIND_MIN_MATCHES_DUO) continue;
    if (tally.aWins > tally.aLosses) {
      bump(scores, tally.aId);
      bump(scores, tally.bId);
    }
  }
  return scores;
}

function bump(scores: Map<string, number>, playerId: string): void {
  scores.set(playerId, (scores.get(playerId) ?? 0) + 1);
}

export function computeCombatAwards(
  aggregates: PlayerAggregate[],
  directory: Directory,
  rivalries: PairTally[],
): RewindCombatAwards {
  const nemesisScores = countNemesisVictims(rivalries);

  return {
    biggestUpset: upsetAward(aggregates, directory),
    giantKiller: award(aggregates, directory, (agg) => agg.giantKillerWins),
    leaderHunter: award(aggregates, directory, (agg) => agg.winsVsRank1),
    rivalry: computeRivalry(rivalries, directory),
    nemesis: award(aggregates, directory, (agg) => nemesisScores.get(agg.playerId) ?? 0),
  };
}

// ============================================
// Endurance
// ============================================

export function computeEnduranceAwards(
  aggregates: PlayerAggregate[],
  directory: Directory,
): RewindEnduranceAwards {
  return {
    marathon: award(aggregates, directory, (agg) => agg.matchesPlayed),
    topOneKing: award(aggregates, directory, (agg) => agg.matchesInTop1),
    topThreeKing: award(aggregates, directory, (agg) => agg.matchesInTop3),
    topFiveKing: award(aggregates, directory, (agg) => agg.matchesInTop5),
    longestStreak: award(aggregates, directory, (agg) => agg.bestWinStreak),
  };
}

// ============================================
// Cooperation
// ============================================

/**
 * Best pair by win rate weighted by sample size (rate × √matches), the same
 * shape the player-stats relations already use, so a 10/10 duo does not edge
 * out a 40-match partnership on a technicality.
 */
export function computeDuoAward(duos: PairTally[], directory: Directory): RewindDuoAward | null {
  let best: { tally: PairTally; score: number } | null = null;

  for (const tally of duos) {
    if (tally.matches < REWIND_MIN_MATCHES_DUO) continue;
    const rate = tally.aWins / tally.matches;
    const score = rate * Math.sqrt(tally.matches);
    if (!best || score > best.score || (score === best.score && tally.aId < best.tally.aId)) {
      best = { tally, score };
    }
  }
  if (!best) return null;

  const a = directory.get(best.tally.aId);
  const b = directory.get(best.tally.bId);
  if (!a || !b) return null;
  return {
    players: [a, b],
    matchesTogether: best.tally.matches,
    wins: best.tally.aWins,
    winRate: Math.round((best.tally.aWins / best.tally.matches) * 100),
  };
}

export function computeCooperationAwards(
  aggregates: PlayerAggregate[],
  directory: Directory,
  duos: PairTally[],
): RewindCooperationAwards {
  const partnerScores = countPartnerFans(duos);
  return {
    duo: computeDuoAward(duos, directory),
    bestPartner: award(aggregates, directory, (agg) => partnerScores.get(agg.playerId) ?? 0),
  };
}

// ============================================
// Percentiles
// ============================================

/**
 * "Top X %" on a metric where higher is better. Rank 1 of 100 yields 1, the
 * last player yields 100. Ties share the best position, so two players with the
 * same win rate are told the same thing.
 */
export function topPercentile(values: number[], value: number): number {
  if (values.length === 0) return 100;
  const better = values.filter((other) => other > value).length;
  return Math.max(1, Math.round(((better + 1) / values.length) * 100));
}

export function computePercentiles(
  aggregates: PlayerAggregate[],
  target: PlayerAggregate,
): RewindPercentiles {
  const progression = (agg: PlayerAggregate) => agg.finalMmr - agg.initialMmr;
  return {
    matchesPlayed: topPercentile(
      aggregates.map((agg) => agg.matchesPlayed),
      target.matchesPlayed,
    ),
    winRate: topPercentile(aggregates.map(winRateOf), winRateOf(target)),
    progression: topPercentile(aggregates.map(progression), progression(target)),
    winStreak: topPercentile(
      aggregates.map((agg) => agg.bestWinStreak),
      target.bestWinStreak,
    ),
  };
}

// ============================================
// Award ownership
// ============================================

type AwardGroups = {
  performance: RewindPerformanceAwards;
  combat: RewindCombatAwards;
  endurance: RewindEnduranceAwards;
  cooperation: RewindCooperationAwards;
};

/** Which awards a given player holds — drives the highlight on the award cards. */
export function awardsWonBy(playerId: string, groups: AwardGroups): RewindAwardKey[] {
  const single: [RewindAwardKey, RewindAward | RewindDatedAward | null][] = [
    ["king", groups.performance.king],
    ["peakMmr", groups.performance.peakMmr],
    ["progression", groups.performance.progression],
    ["sniper", groups.performance.sniper],
    ["biggestUpset", groups.combat.biggestUpset],
    ["giantKiller", groups.combat.giantKiller],
    ["leaderHunter", groups.combat.leaderHunter],
    ["nemesis", groups.combat.nemesis],
    ["marathon", groups.endurance.marathon],
    ["topOneKing", groups.endurance.topOneKing],
    ["topThreeKing", groups.endurance.topThreeKing],
    ["topFiveKing", groups.endurance.topFiveKing],
    ["longestStreak", groups.endurance.longestStreak],
    ["bestPartner", groups.cooperation.bestPartner],
  ];

  const won = single
    .filter(([, value]) => value?.player.playerId === playerId)
    .map(([key]) => key);

  const holdsPair = (award: { players: [RewindPlayerRef, RewindPlayerRef] } | null) =>
    award?.players.some((player) => player.playerId === playerId) ?? false;

  if (holdsPair(groups.combat.rivalry)) won.push("rivalry");
  if (holdsPair(groups.cooperation.duo)) won.push("duo");
  return won;
}
