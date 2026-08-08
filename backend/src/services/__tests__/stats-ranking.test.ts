import { describe, it, expect } from "bun:test";

import {
  assignCompetitionRanks,
  cutWholeRankGroups,
  isFlatRanking,
  omittedTiedWithLast,
  weightedRateTie,
} from "../stats-ranking";

type Entry = { id: string; score: number };

const byScore = (a: Entry, b: Entry) => a.score === b.score;

function rank(scores: number[]) {
  const sorted = scores.map((score, i) => ({ id: `p${i}`, score }));
  return assignCompetitionRanks(sorted, byScore);
}

describe("assignCompetitionRanks", () => {
  it("gives tied entries the same rank and skips the ones they consume", () => {
    expect(rank([10, 8, 8, 5]).map((e) => e.rank)).toEqual([1, 2, 2, 4]);
  });

  it("reports how wide each tied group is", () => {
    expect(rank([8, 8, 8, 5]).map((e) => e.tiedCount)).toEqual([3, 3, 3, 1]);
  });

  it("handles an empty list", () => {
    expect(rank([])).toEqual([]);
  });
});

describe("cutWholeRankGroups", () => {
  it("stops at the rank limit and hands back what it dropped", () => {
    const { shown, omitted } = cutWholeRankGroups(rank([10, 9, 8, 7]), 3, 6);

    expect(shown.map((e) => e.item.score)).toEqual([10, 9, 8]);
    expect(omitted.map((e) => e.item.score)).toEqual([7]);
  });

  it("never splits a tied group straddling the cut", () => {
    // Ranks 1, 2, 3, 3: taking the third rank means taking both of its members.
    const { shown, omitted } = cutWholeRankGroups(rank([10, 9, 8, 8]), 3, 6);

    expect(shown).toHaveLength(4);
    expect(omitted).toEqual([]);
  });

  it("drops a whole group rather than half of it when the rows run out", () => {
    const { shown, omitted } = cutWholeRankGroups(rank([10, 9, 8, 8, 8, 8]), 3, 5);

    expect(shown.map((e) => e.item.score)).toEqual([10, 9]);
    expect(omitted).toHaveLength(4);
  });

  it("still shows something when the first group is wider than the cap", () => {
    const { shown, omitted } = cutWholeRankGroups(rank([8, 8, 8, 8]), 3, 2);

    expect(shown).toHaveLength(2);
    expect(omitted).toHaveLength(2);
  });
});

describe("omittedTiedWithLast", () => {
  it("counts nobody when the cut fell on a rank boundary", () => {
    // 10, 9, 8 shown and 7 dropped: the dropped entry is behind, not tied.
    const { shown, omitted } = cutWholeRankGroups(rank([10, 9, 8, 7]), 3, 6);

    expect(omittedTiedWithLast(shown, omitted)).toEqual([]);
  });

  it("counts only the members of the rank the cut ran through", () => {
    const { shown, omitted } = cutWholeRankGroups(rank([8, 8, 8, 8, 5]), 3, 2);

    // Two of the four leaders shown, the other two are tied with them; the 5 is not.
    expect(omittedTiedWithLast(shown, omitted).map((e) => e.score)).toEqual([8, 8]);
  });
});

describe("isFlatRanking", () => {
  it("is true when every entry shares rank 1", () => {
    expect(isFlatRanking(rank([8, 8, 8]))).toBe(true);
  });

  it("is false for a lone entry — nobody to be tied with", () => {
    expect(isFlatRanking(rank([8]))).toBe(false);
  });

  it("is false as soon as one entry is ahead", () => {
    expect(isFlatRanking(rank([9, 8, 8]))).toBe(false);
  });
});

describe("weightedRateTie", () => {
  const tie = weightedRateTie<{ rate: number; played: number }>(
    (e) => e.rate,
    (e) => e.played,
  );

  it("ties equal rates on equal samples", () => {
    expect(tie({ rate: 0.5, played: 10 }, { rate: 0.5, played: 10 })).toBe(true);
  });

  it("separates equal rates on different samples", () => {
    // The sample size is a real criterion, not a tie-break: 3 wins from 3 beats 1 from 1.
    expect(tie({ rate: 1, played: 3 }, { rate: 1, played: 1 })).toBe(false);
  });

  it("absorbs floating point drift", () => {
    expect(tie({ rate: 0.1 + 0.2, played: 4 }, { rate: 0.3, played: 4 })).toBe(true);
  });
});
