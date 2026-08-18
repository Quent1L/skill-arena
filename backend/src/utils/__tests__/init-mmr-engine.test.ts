/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, mock } from "bun:test";

let seasons: any[] = [];
let storedVersions = new Map<string, { version: number }>();

const insertedStamps: { seasonId: string; version: number }[] = [];

function makeSelectChain(): any {
  const chain: any = {
    then: (resolve: any, reject: any) => Promise.resolve(seasons).then(resolve, reject),
    from: () => chain,
    where: () => chain,
  };
  return chain;
}

mock.module("../../config/database", () => ({
  db: {
    select: mock(() => makeSelectChain()),
    query: {
      computedData: {
        findFirst: mock(() => {
          // The season id is buried in the drizzle condition; the tests drive the
          // lookup through a queue instead of parsing it.
          const seasonId = lookupQueue.shift();
          const stored = seasonId ? storedVersions.get(seasonId) : undefined;
          return Promise.resolve(stored ? { data: stored } : undefined);
        }),
      },
    },
    insert: mock(() => ({
      values: (row: any) => ({
        onConflictDoUpdate: () => {
          insertedStamps.push({ seasonId: row.tournamentId, version: row.data.version });
          storedVersions.set(row.tournamentId, row.data);
          return Promise.resolve();
        },
      }),
    })),
  },
}));

const enqueued: string[] = [];
mock.module("../../services/mmr-job-queue.service", () => ({
  enqueueMmrSeasonRecalculation: mock((id: string) => {
    enqueued.push(id);
    return Promise.resolve();
  }),
}));

let lookupQueue: string[] = [];

const { recalculateOutdatedRankedSeasons } = await import("../init-mmr-engine");
const { MMR_ENGINE_VERSION } = await import("../../services/mmr-engine");

describe("recalculateOutdatedRankedSeasons", () => {
  beforeEach(() => {
    seasons = [
      { id: "s1", name: "Season 1" },
      { id: "s2", name: "Season 2" },
    ];
    storedVersions = new Map();
    lookupQueue = [];
    enqueued.length = 0;
    insertedStamps.length = 0;
  });

  it("enqueues seasons never stamped and sets the current version", async () => {
    lookupQueue = ["s1", "s2"];
    await recalculateOutdatedRankedSeasons();

    expect(enqueued).toEqual(["s1", "s2"]);
    expect(insertedStamps).toEqual([
      { seasonId: "s1", version: MMR_ENGINE_VERSION },
      { seasonId: "s2", version: MMR_ENGINE_VERSION },
    ]);
  });

  it("does not re-enqueue anything on the next startup", async () => {
    lookupQueue = ["s1", "s2"];
    await recalculateOutdatedRankedSeasons();
    enqueued.length = 0;

    lookupQueue = ["s1", "s2"];
    await recalculateOutdatedRankedSeasons();

    expect(enqueued).toEqual([]);
  });

  it("enqueues a season left on an older version", async () => {
    storedVersions.set("s1", { version: MMR_ENGINE_VERSION });
    storedVersions.set("s2", { version: MMR_ENGINE_VERSION - 1 });
    lookupQueue = ["s1", "s2"];

    await recalculateOutdatedRankedSeasons();

    expect(enqueued).toEqual(["s2"]);
  });

  it("does nothing without an active ranked season", async () => {
    seasons = [];
    await recalculateOutdatedRankedSeasons();

    expect(enqueued).toEqual([]);
    expect(insertedStamps).toEqual([]);
  });
});
