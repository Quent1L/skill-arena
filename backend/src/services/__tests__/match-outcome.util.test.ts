import { describe, it, expect } from "bun:test";
import {
  computeMatchOutcome,
  resolveRanks,
  resolveRankInfo,
  classifyRank,
  winnerSideToPosition,
  type PointsConfig,
} from "../match-outcome.util";

const matchResultCfg: PointsConfig = {
  pointPerVictory: 3,
  pointPerDraw: 1,
  pointPerLoss: 0,
  standingsPointsSource: "match_result",
  rankPoints: null,
};

describe("match-outcome.util", () => {
  describe("2-side (single A/B winner)", () => {
    it("score win: side 1 wins → winnerSide A, 3/0 points", () => {
      const out = computeMatchOutcome(
        [
          { position: 1, score: 10 },
          { position: 2, score: 5 },
        ],
        matchResultCfg,
      );
      expect(out.winnerSide).toBe("A");
      expect(out.sides.find((s) => s.position === 1)?.pointsAwarded).toBe(3);
      expect(out.sides.find((s) => s.position === 2)?.pointsAwarded).toBe(0);
      expect(out.sides.find((s) => s.position === 1)?.rank).toBe(1);
    });

    it("draw: equal scores → winnerSide null, 1/1 points", () => {
      const out = computeMatchOutcome(
        [
          { position: 1, score: 5 },
          { position: 2, score: 5 },
        ],
        matchResultCfg,
      );
      expect(out.winnerSide).toBeNull();
      expect(out.sides.every((s) => s.pointsAwarded === 1)).toBe(true);
      expect(out.sides.every((s) => s.rank === 1)).toBe(true);
    });

    it("explicit winnerPosition overrides scores", () => {
      const out = computeMatchOutcome(
        [
          { position: 1, score: 0 },
          { position: 2, score: 0 },
        ],
        matchResultCfg,
        2,
      );
      expect(out.winnerSide).toBe("B");
    });
  });

  describe("N-way", () => {
    it("rank source: 3 sides get table points by placement", () => {
      const cfg: PointsConfig = { ...matchResultCfg, standingsPointsSource: "rank", rankPoints: [3, 1, 0] };
      const out = computeMatchOutcome(
        [
          { position: 1, score: 7, rank: 2 },
          { position: 2, score: 13, rank: 1 },
          { position: 3, score: 4, rank: 3 },
        ],
        cfg,
      );
      expect(out.winnerSide).toBeNull(); // N>2 → no A/B winner
      expect(out.sides.find((s) => s.position === 2)?.pointsAwarded).toBe(3);
      expect(out.sides.find((s) => s.position === 1)?.pointsAwarded).toBe(1);
      expect(out.sides.find((s) => s.position === 3)?.pointsAwarded).toBe(0);
    });

    it("score source: points equal the entered score", () => {
      const cfg: PointsConfig = { ...matchResultCfg, standingsPointsSource: "score" };
      const out = computeMatchOutcome(
        [
          { position: 1, score: 13, rank: 1 },
          { position: 2, score: 9, rank: 2 },
          { position: 3, score: 7, rank: 3 },
        ],
        cfg,
      );
      expect(out.sides.find((s) => s.position === 1)?.pointsAwarded).toBe(13);
      expect(out.sides.find((s) => s.position === 2)?.pointsAwarded).toBe(9);
      expect(out.sides.find((s) => s.position === 3)?.pointsAwarded).toBe(7);
    });

    it("match_result source: only sole rank-1 wins, others lose", () => {
      const out = computeMatchOutcome(
        [
          { position: 1, rank: 1 },
          { position: 2, rank: 2 },
          { position: 3, rank: 3 },
        ],
        matchResultCfg,
      );
      expect(out.sides.find((s) => s.position === 1)?.pointsAwarded).toBe(3);
      expect(out.sides.find((s) => s.position === 2)?.pointsAwarded).toBe(0);
      expect(out.sides.find((s) => s.position === 3)?.pointsAwarded).toBe(0);
    });
  });

  describe("resolveRanks", () => {
    it("derives ranks from scores when no explicit rank, with ties", () => {
      const ranks = resolveRanks([
        { position: 1, score: 10 },
        { position: 2, score: 10 },
        { position: 3, score: 5 },
      ]);
      expect(ranks.get(1)).toBe(1);
      expect(ranks.get(2)).toBe(1);
      expect(ranks.get(3)).toBe(3);
    });
  });

  describe("winnerSideToPosition", () => {
    it("maps A→1, B→2, null→null", () => {
      expect(winnerSideToPosition("A")).toBe(1);
      expect(winnerSideToPosition("B")).toBe(2);
      expect(winnerSideToPosition(null)).toBeNull();
    });
  });

  describe("classifyRank", () => {
    it("sole rank 1 is a win", () => {
      expect(classifyRank(1, 1)).toEqual({ isWin: true, isDraw: false });
    });
    it("shared rank 1 is a draw", () => {
      expect(classifyRank(1, 2)).toEqual({ isWin: false, isDraw: true });
    });
    it("rank > 1 is a loss", () => {
      expect(classifyRank(2, 1)).toEqual({ isWin: false, isDraw: false });
    });
  });

  describe("resolveRankInfo", () => {
    it("returns ranks and the rank-1 count from persisted ranks", () => {
      const info = resolveRankInfo([
        { position: 1, rank: 2 },
        { position: 2, rank: 1 },
        { position: 3, rank: 3 },
      ]);
      expect(info.rankByPosition.get(2)).toBe(1);
      expect(info.rank1Count).toBe(1);
    });
    it("derives ranks from the 2-side winner position when ranks are absent", () => {
      const info = resolveRankInfo(
        [{ position: 1 }, { position: 2 }],
        winnerSideToPosition("B"),
      );
      expect(info.rankByPosition.get(1)).toBe(2);
      expect(info.rankByPosition.get(2)).toBe(1);
      expect(info.rank1Count).toBe(1);
    });
    it("a null winner (draw) puts both sides at rank 1", () => {
      const info = resolveRankInfo(
        [{ position: 1 }, { position: 2 }],
        winnerSideToPosition(null),
      );
      expect(info.rank1Count).toBe(2);
    });
  });
});
