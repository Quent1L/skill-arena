/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, mock } from "bun:test";

// ─── Mocks ───────────────────────────────────────────────────────────────────

mock.module("../../config/i18n", () => ({
  default: { t: (key: string) => key },
}));

// Chainable select() builder whose terminal await resolves to `_selectResult`.
// Used by getMatchPlayerIds (select.from.innerJoin.innerJoin.where).
let _selectResult: any[] = [];
function setSelectResult(rows: any[]) {
  _selectResult = rows;
}
function makeSelectChain(): any {
  const chain: any = {
    then: (resolve: any, reject: any) => Promise.resolve(_selectResult).then(resolve, reject),
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
  };
  return chain;
}

mock.module("../../config/database", () => ({
  db: {
    query: { matches: { findFirst: mock(() => Promise.resolve(null)) } },
    select: mock(() => makeSelectChain()),
  },
}));

const mockAnimRepo = {
  upsert: mock((data: any) => Promise.resolve({ id: `evt-${data.matchId}`, createdAt: new Date(), message: null, ...data })),
  getOfficialEventDeltasByPlayer: mock(() => Promise.resolve(new Map<string, { id: string; mmrDelta: number }>())),
  getPendingForPlayer: mock(() => Promise.resolve([] as any[])),
  markViewed: mock(() => Promise.resolve()),
  updateMessage: mock(() => Promise.resolve()),
};
mock.module("../../repository/mmr-animation-event.repository", () => ({
  mmrAnimationEventRepository: mockAnimRepo,
}));

const mockPlayerMmrRepo = {
  getMmrHistoryOrdered: mock(() => Promise.resolve([] as any[])),
  getBySeasonAndPlayer: mock(() => Promise.resolve(null as any)),
};
mock.module("../../repository/player-mmr.repository", () => ({
  playerMmrRepository: mockPlayerMmrRepo,
}));

const mockRankedRepo = {
  getConfigByTournamentId: mock(() => Promise.resolve({ baseMmr: 1000, kFactor: 32, placementMatches: 3 } as any)),
  getRankTiers: mock(() => Promise.resolve([] as any[])),
};
mock.module("../../repository/ranked-season.repository", () => ({
  rankedSeasonRepository: mockRankedRepo,
}));

mock.module("../mmr-calculation.service", () => ({
  mmrCalculationService: {},
}));

const mockWs = { send: mock((_id: string, _msg: any) => undefined) };
mock.module("../websocket.service", () => ({ webSocketService: mockWs }));

// Imported AFTER mocks so the singleton picks them up.
const { mmrAnimationEventService } = await import("../mmr-animation-event.service");

// ─── Helpers ───────────────────────────────────────────────────────────────────

function clearMock(m: ReturnType<typeof mock>) {
  m.mock.calls.length = 0;
  m.mock.results.length = 0;
}

function historyRow(matchId: string, mmrDelta: number) {
  const mmrBefore = 1000;
  return {
    matchId,
    mmrBefore,
    mmrAfter: mmrBefore + mmrDelta,
    mmrDelta,
  };
}

beforeEach(() => {
  [...Object.values(mockAnimRepo), ...Object.values(mockPlayerMmrRepo), ...Object.values(mockRankedRepo), mockWs.send].forEach((m) => clearMock(m as any));
  mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve({ baseMmr: 1000, kFactor: 32, placementMatches: 3 } as any));
  mockRankedRepo.getRankTiers.mockImplementation(() => Promise.resolve([]));
  mockAnimRepo.upsert.mockImplementation((data: any) => Promise.resolve({ id: `evt-${data.matchId}`, createdAt: new Date(), message: null, ...data }));
  setSelectResult([]);
});

// emitted (matchId, reason) pairs from upsert calls
function emitted() {
  return mockAnimRepo.upsert.mock.calls.map((c: any[]) => ({ matchId: c[0].matchId, reason: c[0].reason }));
}

// ─── createRecalcEventsAndBroadcast ─────────────────────────────────────────────

describe("createRecalcEventsAndBroadcast", () => {
  it("émet un event 'recalculated' uniquement pour les matchs au delta changé", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() =>
      Promise.resolve([historyRow("m1", 18), historyRow("m2", -5)]),
    );
    // m1 stored delta differs (15 -> 18), m2 unchanged (-5).
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 15 }],
        ["m2", { id: "evt-m2", mmrDelta: -5 }],
      ])),
    );

    await mmrAnimationEventService.createRecalcEventsAndBroadcast("season-1", ["p1"]);

    // only m1 upserted + broadcast
    expect(mockAnimRepo.upsert.mock.calls.length).toBe(1);
    expect(mockAnimRepo.upsert.mock.calls[0][0].matchId).toBe("m1");
    expect(mockAnimRepo.upsert.mock.calls[0][0].reason).toBe("recalculated");
    expect(mockWs.send.mock.calls.length).toBe(1);
    expect(mockWs.send.mock.calls[0][1].event).toBe("mmr_animation");
  });

  it("n'émet rien quand aucun delta n'a changé", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() =>
      Promise.resolve([historyRow("m1", 15)]),
    );
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([["m1", { id: "evt-m1", mmrDelta: 15 }]])),
    );

    await mmrAnimationEventService.createRecalcEventsAndBroadcast("season-1", ["p1"]);

    expect(mockAnimRepo.upsert.mock.calls.length).toBe(0);
    expect(mockWs.send.mock.calls.length).toBe(0);
  });

  it("n'émet rien pour un match sans event d'animation préexistant", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() =>
      Promise.resolve([historyRow("m1", 18)]),
    );
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map()),
    );

    await mmrAnimationEventService.createRecalcEventsAndBroadcast("season-1", ["p1"]);

    expect(mockAnimRepo.upsert.mock.calls.length).toBe(0);
    expect(mockWs.send.mock.calls.length).toBe(0);
  });

  it("ne fait rien si liste de joueurs vide", async () => {
    await mmrAnimationEventService.createRecalcEventsAndBroadcast("season-1", []);
    expect(mockRankedRepo.getConfigByTournamentId.mock.calls.length).toBe(0);
  });
});

// ─── Vérification de la théorie du flood (chemin de finalisation réel) ──────────
// Reproduit le bug: events d'animation périmés (deltas != mmr_history) → la
// finalisation d'un nouveau match émet un "recalculated" par match désynchronisé.

describe("théorie: flood au prochain match quand les events sont périmés", () => {
  // Historique courant après une reconstruction (recalcul forcé / cascade
  // d'annulation): m1..m3 passés + m4 = nouveau match finalisé.
  const HISTORY = [
    historyRow("m1", 18),
    historyRow("m2", -7),
    historyRow("m3", 12),
    historyRow("m4", 20),
  ];

  beforeEach(() => {
    setSelectResult([{ playerId: "p1" }]); // getMatchPlayerIds(m4) → [p1]
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() => Promise.resolve(HISTORY));
  });

  it("BUG: events périmés sur m1..m3 → finalisation de m4 floode 3 'recalculated' + 1 'match_finalized'", async () => {
    // Deltas stockés différents du mmr_history reconstruit → désync.
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 15 }],
        ["m2", { id: "evt-m2", mmrDelta: -5 }],
        ["m3", { id: "evt-m3", mmrDelta: 10 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    const ev = emitted();
    expect(ev).toContainEqual({ matchId: "m1", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m2", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m3", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m4", reason: "match_finalized" });
    expect(ev.length).toBe(4); // le flood
  });

  it("FIX: events synchronisés (deltas égaux) → finalisation de m4 n'émet que m4", async () => {
    // État après createRecalcEventsAndBroadcast: deltas stockés == mmr_history.
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 18 }],
        ["m2", { id: "evt-m2", mmrDelta: -7 }],
        ["m3", { id: "evt-m3", mmrDelta: 12 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    const ev = emitted();
    expect(ev).toEqual([{ matchId: "m4", reason: "match_finalized" }]);
    expect(mockWs.send.mock.calls.length).toBe(1);
  });

  it("désync partielle: seul m2 a changé → finalisation émet m2 (recalculated) + m4", async () => {
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 18 }],   // synchro
        ["m2", { id: "evt-m2", mmrDelta: -5 }],    // périmé (-5 != -7)
        ["m3", { id: "evt-m3", mmrDelta: 12 }],   // synchro
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    const ev = emitted();
    expect(ev).toContainEqual({ matchId: "m2", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m4", reason: "match_finalized" });
    expect(ev.length).toBe(2);
  });
});

// ─── createCancellationEventsAndBroadcast — guard delta-0 ────────────────────────

describe("createCancellationEventsAndBroadcast", () => {
  it("ignore les joueurs dont le MMR n'a pas changé (delta 0)", async () => {
    const changes = new Map<string, any>([
      ["p1", { mmrBefore: 1000, mmrAfter: 1000, reason: "match_cancelled" }],
      ["p2", { mmrBefore: 1000, mmrAfter: 985, reason: "cascade" }],
    ]);

    await mmrAnimationEventService.createCancellationEventsAndBroadcast("m-cancelled", "season-1", changes);

    // p1 skipped, only p2 emitted
    expect(mockAnimRepo.upsert.mock.calls.length).toBe(1);
    expect(mockAnimRepo.upsert.mock.calls[0][0].playerId).toBe("p2");
    expect(mockWs.send.mock.calls.length).toBe(1);
    expect(mockWs.send.mock.calls[0][0]).toBe("p2");
  });
});
