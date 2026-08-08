import { describe, it, expect, mock } from "bun:test";

mock.module("../../config/database", () => ({ db: {} }));

import type { MmrChartPoint } from "@skol-arena/shared/types/index";
import { downsampleJourney } from "../season-rewind.service";

function series(length: number): MmrChartPoint[] {
  return Array.from({ length }, (_, i) => ({
    mmrBefore: 1000 + i,
    mmrAfter: 1001 + i,
    mmrDelta: 1,
    outcome: "win" as const,
    playedAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
  }));
}

describe("downsampleJourney", () => {
  it("leaves a curve that already fits alone", () => {
    const points = series(50);
    expect(downsampleJourney(points, 200)).toBe(points);
  });

  it("thins a long curve down to the cap", () => {
    expect(downsampleJourney(series(1_500), 200)).toHaveLength(200);
  });

  it("keeps the first and last point so the line still matches the figures beside it", () => {
    const points = series(1_500);
    const kept = downsampleJourney(points, 200);

    expect(kept[0]).toBe(points[0]!);
    expect(kept.at(-1)).toBe(points.at(-1)!);
  });

  it("keeps the points in order, without repeating any", () => {
    const kept = downsampleJourney(series(973), 200);
    const times = kept.map((point) => point.playedAt.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("still yields a drawable line at the smallest useful cap", () => {
    const kept = downsampleJourney(series(400), 2);
    expect(kept).toHaveLength(2);
  });
});
