import { describe, it, expect, mock } from "bun:test";

mock.module("../../config/database", () => ({ db: {} }));

import { replaySeason, resolveOutcome } from "../season-rewind.replay";
import type {
  SeasonHistoryRow,
  SeasonSideRow,
} from "../../repository/season-rewind.repository";

/**
 * Matches are built as 1v1 by default; playedAt increases with the match index
 * so the chronological order the replay relies on is unambiguous.
 */
let clock = 0;

interface MatchSpec {
  matchId: string;
  /** playerId -> [mmrBefore, mmrAfter] */
  sideA: Record<string, [number, number]>;
  sideB: Record<string, [number, number]>;
  winner: "A" | "B" | "draw";
  isPlacement?: boolean;
}

function build(specs: MatchSpec[]): {
  history: SeasonHistoryRow[];
  sides: SeasonSideRow[];
} {
  const history: SeasonHistoryRow[] = [];
  const sides: SeasonSideRow[] = [];
  clock = 0;

  for (const spec of specs) {
    const playedAt = new Date(Date.UTC(2026, 0, 1, 0, clock++));
    const avg = (team: Record<string, [number, number]>) => {
      const values = Object.values(team).map(([before]) => before);
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };

    for (const [position, team, other] of [
      [1, spec.sideA, spec.sideB],
      [2, spec.sideB, spec.sideA],
    ] as const) {
      for (const [playerId, [mmrBefore, mmrAfter]] of Object.entries(team)) {
        sides.push({ matchId: spec.matchId, position, playerId });
        history.push({
          playerId,
          matchId: spec.matchId,
          mmrBefore,
          mmrAfter,
          mmrDelta: mmrAfter - mmrBefore,
          opponentAvgMmr: avg(other),
          isPlacement: spec.isPlacement ?? false,
          outcome:
            spec.winner === "draw"
              ? "draw"
              : (spec.winner === "A") === (position === 1)
                ? "win"
                : "loss",
          playedAt,
        });
      }
    }
  }
  return { history, sides };
}

function replay(specs: MatchSpec[]) {
  const { history, sides } = build(specs);
  return replaySeason(history, sides);
}

describe("resolveOutcome", () => {
  it("falls back to the delta sign for legacy rows without an outcome", () => {
    const base = {
      playerId: "a",
      matchId: "m",
      mmrBefore: 1000,
      opponentAvgMmr: 1000,
      isPlacement: false,
      outcome: null,
      playedAt: new Date(),
    };
    expect(resolveOutcome({ ...base, mmrAfter: 1016, mmrDelta: 16 })).toBe("win");
    expect(resolveOutcome({ ...base, mmrAfter: 984, mmrDelta: -16 })).toBe("loss");
    expect(resolveOutcome({ ...base, mmrAfter: 1000, mmrDelta: 0 })).toBe("draw");
  });
});

describe("replaySeason — per-player totals", () => {
  it("counts wins, losses and draws from the match outcomes", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1016] }, sideB: { b: [1000, 984] }, winner: "A" },
      { matchId: "m2", sideA: { a: [1016, 1000] }, sideB: { b: [984, 1000] }, winner: "B" },
      { matchId: "m3", sideA: { a: [1000, 1000] }, sideB: { b: [1000, 1000] }, winner: "draw" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a).toMatchObject({ matchesPlayed: 3, wins: 1, losses: 1, draws: 1 });
    expect(a.initialMmr).toBe(1000);
    expect(a.finalMmr).toBe(1000);
  });

  it("tracks the peak MMR together with the match that produced it", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1100] }, sideB: { b: [1000, 900] }, winner: "A" },
      { matchId: "m2", sideA: { a: [1100, 1050] }, sideB: { b: [900, 950] }, winner: "B" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.peakMmr).toBe(1100);
    expect(a.peakMatchId).toBe("m1");
  });

  it("leaves the peak match null when a player never climbs above their start", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 950] }, sideB: { b: [1000, 1050] }, winner: "B" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.peakMmr).toBe(1000);
    expect(a.peakMatchId).toBeNull();
  });
});

describe("replaySeason — streaks", () => {
  it("separates the win streak from the unbeaten streak, which draws extend", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1010] }, sideB: { b: [1000, 990] }, winner: "A" },
      { matchId: "m2", sideA: { a: [1010, 1020] }, sideB: { b: [990, 980] }, winner: "A" },
      { matchId: "m3", sideA: { a: [1020, 1020] }, sideB: { b: [980, 980] }, winner: "draw" },
      { matchId: "m4", sideA: { a: [1020, 1030] }, sideB: { b: [980, 970] }, winner: "A" },
      { matchId: "m5", sideA: { a: [1030, 1010] }, sideB: { b: [970, 990] }, winner: "B" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.bestWinStreak).toBe(2);
    expect(a.bestUnbeatenStreak).toBe(4);
    expect(a.worstLossStreak).toBe(1);
  });

  it("records the worst losing run even when it is not the last one", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 990] }, sideB: { b: [1000, 1010] }, winner: "B" },
      { matchId: "m2", sideA: { a: [990, 980] }, sideB: { b: [1010, 1020] }, winner: "B" },
      { matchId: "m3", sideA: { a: [980, 970] }, sideB: { b: [1020, 1030] }, winner: "B" },
      { matchId: "m4", sideA: { a: [970, 990] }, sideB: { b: [1030, 1010] }, winner: "A" },
      { matchId: "m5", sideA: { a: [990, 980] }, sideB: { b: [1010, 1020] }, winner: "B" },
    ]);

    expect(result.aggregates.get("a")!.worstLossStreak).toBe(3);
  });
});

describe("replaySeason — ranking residency", () => {
  it("counts time at the top in matches, not in days", () => {
    // a leads after m1 and never gives the lead back: 3 matches at rank 1.
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1100] }, sideB: { b: [1000, 900] }, winner: "A" },
      { matchId: "m2", sideA: { a: [1100, 1200] }, sideB: { b: [900, 800] }, winner: "A" },
      { matchId: "m3", sideA: { a: [1200, 1300] }, sideB: { b: [800, 700] }, winner: "A" },
    ]);

    expect(result.aggregates.get("a")!.matchesInTop1).toBe(3);
    expect(result.aggregates.get("b")!.matchesInTop1).toBe(0);
    // Only two players, so both sit inside the top 5 the whole way.
    expect(result.aggregates.get("b")!.matchesInTop5).toBe(3);
  });

  it("remembers the best rank ever held, not the final one", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1200] }, sideB: { b: [1000, 800] }, winner: "A" },
      { matchId: "m2", sideA: { a: [1200, 700] }, sideB: { b: [800, 1300] }, winner: "B" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.bestRank).toBe(1);
    expect(result.aggregates.get("b")!.bestRank).toBe(1);
  });
});

describe("replaySeason — upsets and giant killing", () => {
  it("counts every win over a stronger opponent", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [900, 930] }, sideB: { b: [1200, 1170] }, winner: "A" },
      { matchId: "m2", sideA: { a: [930, 960] }, sideB: { b: [1170, 1140] }, winner: "A" },
      { matchId: "m3", sideA: { a: [960, 990] }, sideB: { c: [800, 770] }, winner: "A" },
    ]);

    // Only the first two beat someone rated above them.
    expect(result.aggregates.get("a")!.giantKillerWins).toBe(2);
  });

  it("keeps the largest gap and the largest reward as separate feats", () => {
    const result = replay([
      // Huge gap, small reward.
      { matchId: "m1", sideA: { a: [900, 910] }, sideB: { b: [1400, 1390] }, winner: "A" },
      // Smaller gap, bigger reward.
      { matchId: "m2", sideA: { a: [910, 990] }, sideB: { c: [1000, 920] }, winner: "A" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.biggestUpsetGap!.matchId).toBe("m1");
    expect(a.biggestUpsetGap!.mmrGap).toBe(500);
    expect(a.biggestUpsetWin!.matchId).toBe("m2");
    expect(a.biggestUpsetWin!.mmrDelta).toBe(80);
  });

  it("ignores wins against a weaker opponent", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1200, 1210] }, sideB: { b: [900, 890] }, winner: "A" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a.giantKillerWins).toBe(0);
    expect(a.biggestUpsetGap).toBeNull();
  });
});

describe("replaySeason — leader hunting", () => {
  it("credits a win against the player ranked #1 before the match", () => {
    const result = replay([
      // b climbs to the top.
      { matchId: "m1", sideA: { b: [1000, 1300] }, sideB: { c: [1000, 700] }, winner: "A" },
      // a then beats the standing leader.
      { matchId: "m2", sideA: { a: [1000, 1100] }, sideB: { b: [1300, 1200] }, winner: "A" },
    ]);

    expect(result.aggregates.get("a")!.winsVsRank1).toBe(1);
  });

  it("does not credit the winner for the #1 spot they take with that very win", () => {
    // a wins the opening match and becomes #1; nobody was leader before it.
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1100] }, sideB: { b: [1000, 900] }, winner: "A" },
    ]);

    expect(result.aggregates.get("a")!.winsVsRank1).toBe(0);
  });

  it("skips a leader who is still playing placement matches", () => {
    const result = replay([
      // b tops the ladder but every row is a placement row.
      {
        matchId: "m1",
        sideA: { b: [1000, 1300] },
        sideB: { c: [1000, 700] },
        winner: "A",
        isPlacement: true,
      },
      { matchId: "m2", sideA: { a: [1000, 1100] }, sideB: { b: [1300, 1200] }, winner: "A" },
    ]);

    expect(result.aggregates.get("a")!.winsVsRank1).toBe(0);
  });

  it("hands the leader title to the best settled player when the top is unsettled", () => {
    const result = replay([
      // b tops the ladder on placement rows only — no title to hunt yet.
      {
        matchId: "m1",
        sideA: { b: [1000, 1400] },
        sideB: { c: [1000, 600] },
        winner: "A",
        isPlacement: true,
      },
      // d settles below b, becoming the highest established player.
      { matchId: "m2", sideA: { d: [1000, 1200] }, sideB: { e: [1000, 800] }, winner: "A" },
      // Beating d counts: the leaderboard that matters is the settled one.
      { matchId: "m3", sideA: { a: [1000, 1100] }, sideB: { d: [1200, 1100] }, winner: "A" },
    ]);

    expect(result.aggregates.get("a")!.winsVsRank1).toBe(1);
  });
});

describe("replaySeason — pair tallies", () => {
  it("records teammates as duos and the other side as rivalries", () => {
    const result = replay([
      {
        matchId: "m1",
        sideA: { a: [1000, 1010], b: [1000, 1010] },
        sideB: { c: [1000, 990], d: [1000, 990] },
        winner: "A",
      },
    ]);

    expect(result.duos).toHaveLength(2); // a+b and c+d
    expect(result.rivalries).toHaveLength(4); // every cross-side pair

    const ab = result.duos.find((t) => t.aId === "a" && t.bId === "b")!;
    expect(ab).toMatchObject({ matches: 1, aWins: 1, aLosses: 0 });
  });

  it("keeps a pair's record from the lexicographically first player's side", () => {
    const result = replay([
      { matchId: "m1", sideA: { z: [1000, 1010] }, sideB: { a: [1000, 990] }, winner: "A" },
      { matchId: "m2", sideA: { a: [990, 1000] }, sideB: { z: [1010, 1000] }, winner: "A" },
    ]);

    // Stored under a<z whichever side each player was on.
    const pair = result.rivalries.find((t) => t.aId === "a" && t.bId === "z")!;
    expect(pair).toMatchObject({ matches: 2, aWins: 1, aLosses: 1, draws: 0 });
  });

  it("counts a draw for both members of a pair", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1000] }, sideB: { b: [1000, 1000] }, winner: "draw" },
    ]);

    expect(result.rivalries[0]).toMatchObject({ matches: 1, aWins: 0, aLosses: 0, draws: 1 });
  });
});

describe("replaySeason — determinism", () => {
  it("produces identical aggregates across two runs on the same data", () => {
    const specs: MatchSpec[] = [
      { matchId: "m1", sideA: { a: [1000, 1050] }, sideB: { b: [1000, 950] }, winner: "A" },
      { matchId: "m2", sideA: { b: [950, 1000] }, sideB: { c: [1000, 950] }, winner: "A" },
      { matchId: "m3", sideA: { a: [1050, 1000] }, sideB: { c: [950, 1000] }, winner: "B" },
    ];

    const first = replay(specs);
    const second = replay(specs);
    expect([...first.aggregates.entries()]).toEqual([...second.aggregates.entries()]);
    expect(first.rivalries).toEqual(second.rivalries);
  });

  it("handles a season nobody played", () => {
    const result = replaySeason([], []);
    expect(result.aggregates.size).toBe(0);
    expect(result.matchCount).toBe(0);
  });

  it("handles a player with a single match", () => {
    const result = replay([
      { matchId: "m1", sideA: { a: [1000, 1016] }, sideB: { b: [1000, 984] }, winner: "A" },
    ]);

    const a = result.aggregates.get("a")!;
    expect(a).toMatchObject({ matchesPlayed: 1, wins: 1, bestWinStreak: 1, bestRank: 1 });
    expect(a.points).toHaveLength(1);
  });
});
