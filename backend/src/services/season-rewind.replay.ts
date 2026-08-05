import type { MmrChartPoint, MmrHistoryOutcome } from "@skol-arena/shared/types/index";
import type { SeasonHistoryRow, SeasonSideRow } from "../repository/season-rewind.repository";

/**
 * Chronological replay of a finished season.
 *
 * Most rewind figures could be read straight off player_mmr, but three cannot:
 * how long a player stayed in the top 1/3/5, the best rank they ever held, and
 * how often they beat whoever was #1 at the time. All three need the standings
 * as they stood after every single match, which only a replay gives. Since we
 * are walking the season anyway, the per-player counters and the pair tallies
 * ride along in the same pass.
 */

/** A feat still holding raw ids: display names are attached once, by the service. */
export interface FeatDraft {
  matchId: string;
  playedAt: Date;
  opponentId: string | null;
  mmrDelta: number;
  mmrGap: number;
}

export interface PlayerAggregate {
  playerId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  initialMmr: number;
  finalMmr: number;
  peakMmr: number;
  peakMatchId: string | null;
  peakPlayedAt: Date | null;
  bestRank: number;
  matchesInTop1: number;
  matchesInTop3: number;
  matchesInTop5: number;
  bestWinStreak: number;
  bestUnbeatenStreak: number;
  worstLossStreak: number;
  giantKillerWins: number;
  winsVsRank1: number;
  biggestUpsetWin: FeatDraft | null;
  biggestUpsetGap: FeatDraft | null;
  points: MmrChartPoint[];
  currentWinStreak: number;
  currentUnbeatenStreak: number;
  currentLossStreak: number;
}

/** Head-to-head record of two players, from `aId`'s point of view. */
export interface PairTally {
  aId: string;
  bId: string;
  matches: number;
  aWins: number;
  aLosses: number;
  draws: number;
}

export interface ReplayResult {
  aggregates: Map<string, PlayerAggregate>;
  /** Opponent pairs — feeds the Rivalry and Nemesis awards. */
  rivalries: PairTally[];
  /** Teammate pairs — feeds the Duo and Best partner awards. */
  duos: PairTally[];
  matchCount: number;
}

interface ReplayState {
  aggregates: Map<string, PlayerAggregate>;
  currentMmr: Map<string, number>;
  ranking: string[];
  /** Players past their placement matches — the only ones whose #1 spot counts. */
  settled: Set<string>;
  rivalries: Map<string, PairTally>;
  duos: Map<string, PairTally>;
}

/** Legacy history rows predate the outcome column; the delta sign stands in for them. */
export function resolveOutcome(row: SeasonHistoryRow): MmrHistoryOutcome {
  if (row.outcome === "win" || row.outcome === "loss" || row.outcome === "draw") {
    return row.outcome;
  }
  if (row.mmrDelta > 0) return "win";
  if (row.mmrDelta < 0) return "loss";
  return "draw";
}

function createAggregate(playerId: string, initialMmr: number): PlayerAggregate {
  return {
    playerId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    initialMmr,
    finalMmr: initialMmr,
    peakMmr: initialMmr,
    peakMatchId: null,
    peakPlayedAt: null,
    bestRank: Number.MAX_SAFE_INTEGER,
    matchesInTop1: 0,
    matchesInTop3: 0,
    matchesInTop5: 0,
    bestWinStreak: 0,
    bestUnbeatenStreak: 0,
    worstLossStreak: 0,
    giantKillerWins: 0,
    winsVsRank1: 0,
    biggestUpsetWin: null,
    biggestUpsetGap: null,
    points: [],
    currentWinStreak: 0,
    currentUnbeatenStreak: 0,
    currentLossStreak: 0,
  };
}

function updateStreaks(agg: PlayerAggregate, outcome: MmrHistoryOutcome): void {
  if (outcome === "win") {
    agg.currentWinStreak++;
    agg.currentUnbeatenStreak++;
    agg.currentLossStreak = 0;
  } else if (outcome === "draw") {
    agg.currentWinStreak = 0;
    agg.currentUnbeatenStreak++;
    agg.currentLossStreak = 0;
  } else {
    agg.currentWinStreak = 0;
    agg.currentUnbeatenStreak = 0;
    agg.currentLossStreak++;
  }
  agg.bestWinStreak = Math.max(agg.bestWinStreak, agg.currentWinStreak);
  agg.bestUnbeatenStreak = Math.max(agg.bestUnbeatenStreak, agg.currentUnbeatenStreak);
  agg.worstLossStreak = Math.max(agg.worstLossStreak, agg.currentLossStreak);
}

/**
 * Records the two "beat someone stronger" feats. They rank on different metrics
 * on purpose: the biggest gap is the better story, the biggest MMR gain is the
 * better reward, and they are rarely the same match.
 */
function updateUpsets(agg: PlayerAggregate, row: SeasonHistoryRow, opponent: string | null): void {
  const gap = row.opponentAvgMmr - row.mmrBefore;
  if (gap <= 0) return;

  agg.giantKillerWins++;
  const feat: FeatDraft = {
    matchId: row.matchId,
    playedAt: row.playedAt,
    opponentId: opponent,
    mmrDelta: row.mmrDelta,
    mmrGap: gap,
  };
  if (!agg.biggestUpsetWin || row.mmrDelta > agg.biggestUpsetWin.mmrDelta) {
    agg.biggestUpsetWin = feat;
  }
  if (!agg.biggestUpsetGap || gap > agg.biggestUpsetGap.mmrGap) {
    agg.biggestUpsetGap = { ...feat };
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Tallies are stored once per unordered pair, always from the lexicographically first id. */
function addToTally(
  store: Map<string, PairTally>,
  first: string,
  second: string,
  outcomeOfFirst: MmrHistoryOutcome,
): void {
  const [aId, bId] = first < second ? [first, second] : [second, first];
  const flip = aId !== first;
  const key = pairKey(first, second);
  const tally = store.get(key) ?? { aId, bId, matches: 0, aWins: 0, aLosses: 0, draws: 0 };

  tally.matches++;
  if (outcomeOfFirst === "draw") tally.draws++;
  else if ((outcomeOfFirst === "win") !== flip) tally.aWins++;
  else tally.aLosses++;

  store.set(key, tally);
}

function recordPairs(
  state: ReplayState,
  sides: Map<number, string[]>,
  outcomes: Map<string, MmrHistoryOutcome>,
): void {
  const teamA = sides.get(1) ?? [];
  const teamB = sides.get(2) ?? [];

  for (const team of [teamA, teamB]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const outcome = outcomes.get(team[i]!);
        if (outcome) addToTally(state.duos, team[i]!, team[j]!, outcome);
      }
    }
  }

  for (const a of teamA) {
    for (const b of teamB) {
      const outcome = outcomes.get(a);
      if (outcome) addToTally(state.rivalries, a, b, outcome);
    }
  }
}

/**
 * Re-sorts the standings and credits everyone currently in the top brackets.
 * Residency is counted in matches, not days: a season played over two months
 * and one played over a weekend should reward the same way.
 */
function refreshRanking(state: ReplayState): void {
  state.ranking = [...state.currentMmr.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([playerId]) => playerId);

  for (let index = 0; index < state.ranking.length; index++) {
    const agg = state.aggregates.get(state.ranking[index]!);
    if (!agg) continue;
    const rank = index + 1;
    agg.bestRank = Math.min(agg.bestRank, rank);
    if (rank <= 1) agg.matchesInTop1++;
    if (rank <= 3) agg.matchesInTop3++;
    if (rank <= 5) agg.matchesInTop5++;
  }
}

function opponentsOf(playerId: string, sides: Map<number, string[]>): string[] {
  const teamA = sides.get(1) ?? [];
  return teamA.includes(playerId) ? (sides.get(2) ?? []) : teamA;
}

function applyRow(
  state: ReplayState,
  row: SeasonHistoryRow,
  sides: Map<number, string[]>,
  leaderId: string | null,
): MmrHistoryOutcome {
  const agg =
    state.aggregates.get(row.playerId) ?? createAggregate(row.playerId, row.mmrBefore);
  state.aggregates.set(row.playerId, agg);

  const outcome = resolveOutcome(row);
  const opponents = opponentsOf(row.playerId, sides);

  agg.matchesPlayed++;
  if (outcome === "win") agg.wins++;
  else if (outcome === "loss") agg.losses++;
  else agg.draws++;

  updateStreaks(agg, outcome);
  if (outcome === "win") {
    updateUpsets(agg, row, opponents[0] ?? null);
    if (leaderId && leaderId !== row.playerId && opponents.includes(leaderId)) {
      agg.winsVsRank1++;
    }
  }

  if (row.mmrAfter > agg.peakMmr) {
    agg.peakMmr = row.mmrAfter;
    agg.peakMatchId = row.matchId;
    agg.peakPlayedAt = row.playedAt;
  }

  agg.finalMmr = row.mmrAfter;
  agg.points.push({
    mmrBefore: row.mmrBefore,
    mmrAfter: row.mmrAfter,
    mmrDelta: row.mmrDelta,
    outcome,
    playedAt: row.playedAt,
  });

  state.currentMmr.set(row.playerId, row.mmrAfter);
  if (!row.isPlacement) state.settled.add(row.playerId);
  return outcome;
}

/** Rows arrive ordered by (playedAt, matchId), so a match's rows are contiguous. */
function groupByMatch(history: SeasonHistoryRow[]): SeasonHistoryRow[][] {
  const groups: SeasonHistoryRow[][] = [];
  let current: SeasonHistoryRow[] = [];

  for (const row of history) {
    if (current.length > 0 && current[0]!.matchId !== row.matchId) {
      groups.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function buildSideIndex(sides: SeasonSideRow[]): Map<string, Map<number, string[]>> {
  const index = new Map<string, Map<number, string[]>>();
  for (const side of sides) {
    const byPosition = index.get(side.matchId) ?? new Map<number, string[]>();
    const players = byPosition.get(side.position) ?? [];
    players.push(side.playerId);
    byPosition.set(side.position, players);
    index.set(side.matchId, byPosition);
  }
  return index;
}

/**
 * The current #1, read *before* the match is applied — otherwise a player who
 * dethrones the leader would be credited with beating the leader they just
 * became. Players still in placement are skipped: the top of an empty ladder is
 * noise, not a title worth hunting.
 */
function currentLeader(state: ReplayState): string | null {
  for (const playerId of state.ranking) {
    if (state.settled.has(playerId)) return playerId;
  }
  return null;
}

export function replaySeason(
  history: SeasonHistoryRow[],
  sides: SeasonSideRow[],
): ReplayResult {
  const state: ReplayState = {
    aggregates: new Map(),
    currentMmr: new Map(),
    ranking: [],
    settled: new Set(),
    rivalries: new Map(),
    duos: new Map(),
  };
  const sideIndex = buildSideIndex(sides);
  const matchGroups = groupByMatch(history);

  for (const rows of matchGroups) {
    const matchSides = sideIndex.get(rows[0]!.matchId) ?? new Map<number, string[]>();
    const leaderId = currentLeader(state);
    const outcomes = new Map<string, MmrHistoryOutcome>();

    for (const row of rows) {
      outcomes.set(row.playerId, applyRow(state, row, matchSides, leaderId));
    }
    recordPairs(state, matchSides, outcomes);
    refreshRanking(state);
  }

  return {
    aggregates: state.aggregates,
    rivalries: [...state.rivalries.values()],
    duos: [...state.duos.values()],
    matchCount: matchGroups.length,
  };
}
