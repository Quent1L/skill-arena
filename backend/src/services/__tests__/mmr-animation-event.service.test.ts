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

const echoRow = (data: any) => ({ id: `evt-${data.matchId}`, createdAt: new Date(), message: null, ...data });

const mockAnimRepo = {
  upsert: mock((data: any) => Promise.resolve(echoRow(data))),
  bulkUpsert: mock((rows: any[]) => Promise.resolve(rows.map(echoRow))),
  getOfficialEventDeltasByPlayer: mock(() => Promise.resolve(new Map<string, { id: string; mmrDelta: number; seenDelta: number }>())),
  getOfficialEventDeltasForPlayers: mock(() => Promise.resolve(new Map<string, Map<string, { id: string; mmrDelta: number; seenDelta: number }>>())),
  getPendingForPlayer: mock(() => Promise.resolve([] as any[])),
  markViewed: mock(() => Promise.resolve()),
  updateMessage: mock(() => Promise.resolve()),
};
mock.module("../../repository/mmr-animation-event.repository", () => ({
  mmrAnimationEventRepository: mockAnimRepo,
}));

const mockPlayerMmrRepo = {
  getMmrHistoryOrdered: mock(() => Promise.resolve([] as any[])),
  getMmrHistoryOrderedForPlayers: mock(() => Promise.resolve(new Map<string, any[]>())),
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
  return { matchId, mmrBefore, mmrAfter: mmrBefore + mmrDelta, mmrDelta };
}

beforeEach(() => {
  [...Object.values(mockAnimRepo), ...Object.values(mockPlayerMmrRepo), ...Object.values(mockRankedRepo), mockWs.send].forEach((m) => clearMock(m as any));
  mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve({ baseMmr: 1000, kFactor: 32, placementMatches: 3 } as any));
  mockRankedRepo.getRankTiers.mockImplementation(() => Promise.resolve([]));
  mockAnimRepo.upsert.mockImplementation((data: any) => Promise.resolve(echoRow(data)));
  mockAnimRepo.bulkUpsert.mockImplementation((rows: any[]) => Promise.resolve(rows.map(echoRow)));
  setSelectResult([]);
});

// (matchId, reason) pairs from the single per-event upsert (finalize path)
function emitted() {
  return mockAnimRepo.upsert.mock.calls.map((c: any[]) => ({ matchId: c[0].matchId, reason: c[0].reason }));
}
// flattened rows passed to bulkUpsert (batch paths)
function bulkRows() {
  return mockAnimRepo.bulkUpsert.mock.calls.flatMap((c: any[]) => c[0]);
}

// ─── persistRecalcEvents (batch, persist-only) ──────────────────────────────────

describe("persistRecalcEvents", () => {
  it("persiste un event 'recalculated' uniquement pour les matchs au delta changé, sans broadcast", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrderedForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", [historyRow("m1", 18), historyRow("m2", -5)]]])),
    );
    // m1 stored+seen delta differs (15 -> 18), m2 unchanged (-5).
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([
        ["p1", new Map([
          ["m1", { id: "evt-m1", mmrDelta: 15, seenDelta: 15 }],
          ["m2", { id: "evt-m2", mmrDelta: -5, seenDelta: -5 }],
        ])],
      ])),
    );

    const affected = await mmrAnimationEventService.persistRecalcEvents("season-1", ["p1"]);

    const rows = bulkRows();
    expect(rows.length).toBe(1);
    expect(rows[0].matchId).toBe("m1");
    expect(rows[0].reason).toBe("recalculated");
    expect(rows[0].mmrDelta).toBe(18); // full delta kept for sync
    expect(rows[0].displayDelta).toBe(3); // differential 18 - seen 15
    expect(affected).toEqual(["p1"]);
    expect(mockWs.send.mock.calls.length).toBe(0); // persist-only
  });

  it("recalcs empilés avant visionnage: displayDelta relatif au delta VU, pas au dernier stocké", async () => {
    // Le joueur a vu +15. Un 1er recalc l'a porté à +18 (stocké, non vu), un 2e
    // le porte à +20. La news depuis le dernier visionnage = 20 - 15 = 5, pas
    // 20 - 18 = 2 (ce que donnerait une base sur le delta stocké).
    mockPlayerMmrRepo.getMmrHistoryOrderedForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", [historyRow("m1", 20)]]])),
    );
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", new Map([["m1", { id: "evt-m1", mmrDelta: 18, seenDelta: 15 }]])]])),
    );

    await mmrAnimationEventService.persistRecalcEvents("season-1", ["p1"]);

    const rows = bulkRows();
    expect(rows.length).toBe(1);
    expect(rows[0].mmrDelta).toBe(20); // sync key = nouveau full
    expect(rows[0].displayDelta).toBe(5); // 20 - seen 15, accumulation correcte
  });

  it("bulkUpsert vide + aucun joueur affecté quand aucun delta n'a changé", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrderedForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", [historyRow("m1", 15)]]])),
    );
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", new Map([["m1", { id: "evt-m1", mmrDelta: 15, seenDelta: 15 }]])]])),
    );

    const affected = await mmrAnimationEventService.persistRecalcEvents("season-1", ["p1"]);

    expect(bulkRows().length).toBe(0);
    expect(affected).toEqual([]);
    expect(mockWs.send.mock.calls.length).toBe(0);
  });

  it("rien pour un match sans event d'animation préexistant", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrderedForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", [historyRow("m1", 18)]]])),
    );
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map()),
    );

    const affected = await mmrAnimationEventService.persistRecalcEvents("season-1", ["p1"]);

    expect(bulkRows().length).toBe(0);
    expect(affected).toEqual([]);
  });

  it("cascade multi-joueurs: un SEUL bulkUpsert, zéro ws.send par event", async () => {
    mockPlayerMmrRepo.getMmrHistoryOrderedForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([
        ["p1", [historyRow("m1", 18)]],
        ["p2", [historyRow("m1", -3), historyRow("m2", 9)]],
      ])),
    );
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([
        ["p1", new Map([["m1", { id: "e1", mmrDelta: 10, seenDelta: 10 }]])],   // changé
        ["p2", new Map([
          ["m1", { id: "e2", mmrDelta: -3, seenDelta: -3 }],                    // inchangé
          ["m2", { id: "e3", mmrDelta: 5, seenDelta: 5 }],                      // changé (5 -> 9)
        ])],
      ])),
    );

    const affected = await mmrAnimationEventService.persistRecalcEvents("season-1", ["p1", "p2"]);

    expect(mockAnimRepo.bulkUpsert.mock.calls.length).toBe(1); // batch unique
    const rows = bulkRows();
    expect(rows.length).toBe(2); // p1/m1 + p2/m2
    expect(affected.sort()).toEqual(["p1", "p2"]);
    expect(mockWs.send.mock.calls.length).toBe(0);
  });

  it("ne fait rien si liste de joueurs vide", async () => {
    const affected = await mmrAnimationEventService.persistRecalcEvents("season-1", []);
    expect(affected).toEqual([]);
    expect(mockRankedRepo.getConfigByTournamentId.mock.calls.length).toBe(0);
  });
});

// ─── persistCancellationEvents (batch, persist-only, guard delta-0) ──────────────

describe("persistCancellationEvents", () => {
  it("ne persiste que les joueurs directs (match_cancelled), displayDelta = -delta vu; ignore le cascade", async () => {
    // p1 a vu +12 pour le match annulé ; le cascade p2 est couvert par persistRecalcEvents.
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() =>
      Promise.resolve(new Map([["p1", new Map([["m-cancelled", { id: "evt", mmrDelta: 12, seenDelta: 12 }]])]])),
    );
    const changes = new Map<string, any>([
      ["p1", { mmrBefore: 1012, mmrAfter: 1000, reason: "match_cancelled" }],
      ["p2", { mmrBefore: 1000, mmrAfter: 985, reason: "cascade" }],
    ]);

    const affected = await mmrAnimationEventService.persistCancellationEvents("m-cancelled", "season-1", changes);

    const rows = bulkRows();
    expect(rows.length).toBe(1);
    expect(rows[0].playerId).toBe("p1");
    expect(rows[0].reason).toBe("match_cancelled");
    expect(rows[0].displayDelta).toBe(-12); // perte des points VUS du match annulé
    expect(rows[0].rankChanged).toBe(false); // pas de badge de rang trompeur
    expect(rows[0].tierAfterName).toBeNull();
    expect(affected).toEqual(["p1"]);
    expect(mockWs.send.mock.calls.length).toBe(0); // persist-only
  });

  it("ignore un joueur direct sans delta vu préalable (displayDelta 0)", async () => {
    mockAnimRepo.getOfficialEventDeltasForPlayers.mockImplementation(() => Promise.resolve(new Map()));
    const changes = new Map<string, any>([
      ["p1", { mmrBefore: 1000, mmrAfter: 990, reason: "match_cancelled" }],
    ]);

    const affected = await mmrAnimationEventService.persistCancellationEvents("m-cancelled", "season-1", changes);

    expect(bulkRows().length).toBe(0);
    expect(affected).toEqual([]);
  });
});

// ─── Théorie du flood (chemin de finalisation réel, inchangé) ───────────────────
// Reproduit le bug: events d'animation périmés (deltas != mmr_history) → la
// finalisation d'un nouveau match émet un "recalculated" par match désynchronisé.

describe("théorie: flood au prochain match quand les events sont périmés", () => {
  const HISTORY = [historyRow("m1", 18), historyRow("m2", -7), historyRow("m3", 12), historyRow("m4", 20)];

  beforeEach(() => {
    setSelectResult([{ playerId: "p1" }]); // getMatchPlayerIds(m4) → [p1]
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() => Promise.resolve(HISTORY));
  });

  it("BUG: events périmés sur m1..m3 → finalisation de m4 floode 3 'recalculated' + 1 'match_finalized'", async () => {
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 15, seenDelta: 15 }],
        ["m2", { id: "evt-m2", mmrDelta: -5, seenDelta: -5 }],
        ["m3", { id: "evt-m3", mmrDelta: 10, seenDelta: 10 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    const ev = emitted();
    expect(ev).toContainEqual({ matchId: "m1", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m2", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m3", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m4", reason: "match_finalized" });
    expect(ev.length).toBe(4);
  });

  it("FIX: events synchronisés → finalisation de m4 n'émet que m4", async () => {
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 18, seenDelta: 18 }],
        ["m2", { id: "evt-m2", mmrDelta: -7, seenDelta: -7 }],
        ["m3", { id: "evt-m3", mmrDelta: 12, seenDelta: 12 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    expect(emitted()).toEqual([{ matchId: "m4", reason: "match_finalized" }]);
    expect(mockWs.send.mock.calls.length).toBe(1);
  });

  it("désync partielle: seul m2 a changé → finalisation émet m2 (recalculated) + m4", async () => {
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 18, seenDelta: 18 }],
        ["m2", { id: "evt-m2", mmrDelta: -5, seenDelta: -5 }],
        ["m3", { id: "evt-m3", mmrDelta: 12, seenDelta: 12 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    const ev = emitted();
    expect(ev).toContainEqual({ matchId: "m2", reason: "recalculated" });
    expect(ev).toContainEqual({ matchId: "m4", reason: "match_finalized" });
    expect(ev.length).toBe(2);
  });
});

// ─── displayDelta sur le chemin de finalisation (collectOfficialEvents) ──────────

describe("createOfficialEventsAndBroadcast: displayDelta", () => {
  const HISTORY = [historyRow("m1", 18), historyRow("m2", -7), historyRow("m4", 20)];

  beforeEach(() => {
    setSelectResult([{ playerId: "p1" }]); // getMatchPlayerIds(m4) → [p1]
    mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() => Promise.resolve(HISTORY));
  });

  // upsert payload for a given match (single per-event finalize path)
  function upsertFor(matchId: string) {
    return mockAnimRepo.upsert.mock.calls.map((c: any[]) => c[0]).find((d) => d.matchId === matchId);
  }

  it("match courant (nouveau) = delta complet ; recalculated = delta - seenDelta", async () => {
    // m1 a été vu à +15, son delta réel est maintenant +18 (désync) → diff +3.
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 15, seenDelta: 15 }],
        ["m2", { id: "evt-m2", mmrDelta: -7, seenDelta: -7 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    expect(upsertFor("m4").displayDelta).toBe(20); // nouveau match → full
    expect(upsertFor("m4").mmrDelta).toBe(20);
    expect(upsertFor("m1").displayDelta).toBe(3); // 18 - seen 15
    expect(upsertFor("m1").mmrDelta).toBe(18); // full conservé pour la sync
    expect(upsertFor("m1").reason).toBe("recalculated");
  });

  it("displayDelta est diffusé dans le payload WS", async () => {
    mockAnimRepo.getOfficialEventDeltasByPlayer.mockImplementation(() =>
      Promise.resolve(new Map([
        ["m1", { id: "evt-m1", mmrDelta: 18, seenDelta: 18 }],
        ["m2", { id: "evt-m2", mmrDelta: -7, seenDelta: -7 }],
      ])),
    );

    await mmrAnimationEventService.createOfficialEventsAndBroadcast("m4", "season-1");

    // m1/m2 synchronisés → seul m4 diffusé
    const sent = mockWs.send.mock.calls.find((c: any[]) => c[1]?.data?.matchId === "m4");
    expect(sent?.[1].data.displayDelta).toBe(20);
  });
});

// ─── getPendingForPlayer: fallback displayDelta sur lignes héritées ──────────────

describe("getPendingForPlayer", () => {
  function pendingRow(matchId: string, mmrDelta: number, displayDelta: number | null) {
    return {
      id: `evt-${matchId}`,
      matchId,
      mmrDelta,
      displayDelta,
      eventType: "official",
      reason: "recalculated",
      rankChanged: false,
      message: null,
      opponents: [],
      teammates: [],
    };
  }

  it("renvoie displayDelta tel quel, et retombe sur mmrDelta quand il est null (ligne pré-migration)", async () => {
    mockAnimRepo.getPendingForPlayer.mockImplementation(() =>
      Promise.resolve([pendingRow("m1", 12, null), pendingRow("m2", 9, 4)] as any),
    );

    const out = await mmrAnimationEventService.getPendingForPlayer("p1", "season-1", "fr");

    expect(out.find((e) => e.matchId === "m1")?.displayDelta).toBe(12); // null → fallback mmrDelta
    expect(out.find((e) => e.matchId === "m2")?.displayDelta).toBe(4); // valeur conservée
  });
});
