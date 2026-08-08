/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { MmrCalculationService } from "../mmr-calculation.service";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// ── DB mock (chainable select + query builders) ────────────────────────────

let _selectResult: any[] = [];

function makeSelectChain() {
  const chain: any = {
    then: (resolve: any, reject: any) => Promise.resolve(_selectResult).then(resolve, reject),
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
  };
  return chain;
}

function setSelectResult(value: any[]) {
  _selectResult = value;
}

const mockDb = {
  query: {
    matches: {
      findFirst: mock(() => Promise.resolve(null as any)),
      findMany: mock(() => Promise.resolve([] as any[])),
    },
    matchSides: {
      findMany: mock(() => Promise.resolve([] as any[])),
    },
  },
  select: mock((_fields: any) => makeSelectChain()),
};

mock.module("../../config/database", () => ({ db: mockDb }));

const mockRankedRepo = {
  getConfigByTournamentId: mock(() => Promise.resolve(null as any)),
  getRankTiers: mock(() => Promise.resolve([] as any[])),
  upsertRankTier: mock((..._args: any[]) => Promise.resolve()),
};

mock.module("../../repository/ranked-season.repository", () => ({
  rankedSeasonRepository: mockRankedRepo,
}));

const mockPlayerMmrRepo = {
  deleteMmrHistoryForPlayer: mock(() => Promise.resolve()),
  getMmrHistoryOrdered: mock(() => Promise.resolve([] as any[])),
  getMmrHistoryForPlayerAndMatch: mock((_seasonId: any, _oppId: any, _matchId: any) => Promise.resolve(null as any)),
  getBySeasonAndPlayer: mock(() => Promise.resolve(null as any)),
  createMmrHistory: mock((_args: any) => Promise.resolve()),
  upsert: mock((_args: any) => Promise.resolve()),
  getAllPlayersBySeasonId: mock(() => Promise.resolve([] as any[])),
  getCheckpointState: mock(() => Promise.resolve(null as any)),
  preloadOpponentHistories: mock(() => Promise.resolve(new Map<string, number>())),
  getPlayerCurrentMmrs: mock(() => Promise.resolve(new Map<string, number>())),
  deleteBySeasonAndPlayer: mock((_seasonId: any, _playerId: any) => Promise.resolve()),
  getFinalizedMatchesPageForSeason: mock((_seasonId: any, _cursor: any, _pageSize: any) => Promise.resolve([] as any[])),
  deleteAllMmrHistoryForSeason: mock(() => Promise.resolve()),
  createMmrHistoryBatch: mock((_rows: any[]) => Promise.resolve()),
};

mock.module("../../repository/player-mmr.repository", () => ({
  playerMmrRepository: mockPlayerMmrRepo,
}));

// Carried-over entry MMR. Empty by default: a season without carry-over.
const mockMmrSeedRepo = {
  getMapBySeason: mock(() => Promise.resolve(new Map<string, number>())),
  getSeedMmr: mock((_seasonId: any, _playerId: any) => Promise.resolve(null as number | null)),
};

mock.module("../../repository/mmr-seed.repository", () => ({
  mmrSeedRepository: mockMmrSeedRepo,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  id: "config-1",
  tournamentId: "season-1",
  baseMmr: 1000,
  kFactor: 32,
  placementMatches: 3,
  usePreviousMmr: false,
  allowAsymmetricMatches: false,
  sourceTierSeasonId: null,
};

function makeMatch(id: string, outcomeType: { scoreCountsForMmr: boolean; points: number } | null = null) {
  return { id, outcomeType };
}

function makeSideResult(opts: {
  opponentPlayerIds?: string[];
  scoreForPlayer?: number;
  scoreForOpponent?: number;
  playerWon?: boolean | null;
}) {
  return {
    opponentPlayerIds: opts.opponentPlayerIds ?? ["opp-1"],
    scoreForPlayer: opts.scoreForPlayer ?? 0,
    scoreForOpponent: opts.scoreForOpponent ?? 0,
    playerWon: opts.playerWon ?? null,
  };
}

function clearMock(m: ReturnType<typeof mock>) {
  m.mock.calls.length = 0;
  m.mock.results.length = 0;
}

function resetMocks() {
  for (const m of Object.values(mockRankedRepo) as ReturnType<typeof mock>[]) clearMock(m);
  for (const m of Object.values(mockPlayerMmrRepo) as ReturnType<typeof mock>[]) clearMock(m);
  for (const m of Object.values(mockMmrSeedRepo) as ReturnType<typeof mock>[]) clearMock(m);

  mockMmrSeedRepo.getMapBySeason.mockImplementation(() => Promise.resolve(new Map()));
  mockMmrSeedRepo.getSeedMmr.mockImplementation(() => Promise.resolve(null));
  mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve(DEFAULT_CONFIG));
  mockRankedRepo.getRankTiers.mockImplementation(() => Promise.resolve([]));
  mockRankedRepo.upsertRankTier.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.deleteMmrHistoryForPlayer.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() => Promise.resolve([]));
  mockPlayerMmrRepo.getMmrHistoryForPlayerAndMatch.mockImplementation(() => Promise.resolve(null));
  mockPlayerMmrRepo.getBySeasonAndPlayer.mockImplementation(() => Promise.resolve(null));
  mockPlayerMmrRepo.createMmrHistory.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.upsert.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() => Promise.resolve([]));
  mockPlayerMmrRepo.getCheckpointState.mockImplementation(() => Promise.resolve(null));
  mockPlayerMmrRepo.preloadOpponentHistories.mockImplementation(() => Promise.resolve(new Map()));
  mockPlayerMmrRepo.getPlayerCurrentMmrs.mockImplementation(() => Promise.resolve(new Map()));
  mockPlayerMmrRepo.deleteBySeasonAndPlayer.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mockImplementation(() => Promise.resolve([]));
  mockPlayerMmrRepo.deleteAllMmrHistoryForSeason.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.createMmrHistoryBatch.mockImplementation(() => Promise.resolve());

  _selectResult = [];
  mockDb.query.matches.findFirst.mockImplementation(() => Promise.resolve(null));
  mockDb.query.matches.findMany.mockImplementation(() => Promise.resolve([]));
  mockDb.query.matchSides.findMany.mockImplementation(() => Promise.resolve([]));
  mockDb.select.mockImplementation((_fields: any) => makeSelectChain());
  clearMock(mockDb.query.matches.findFirst);
  clearMock(mockDb.query.matches.findMany);
  clearMock(mockDb.query.matchSides.findMany);
  clearMock(mockDb.select);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MmrCalculationService", () => {
  let service: MmrCalculationService;

  beforeEach(() => {
    service = new MmrCalculationService();
    resetMocks();
  });

  // ── calculateExpectedScore ─────────────────────────────────────────────────

  describe("calculateExpectedScore", () => {
    it("MMR égaux → 0.5", () => {
      expect(service.calculateExpectedScore(1000, 1000)).toBe(0.5);
    });

    it("joueur 400pts au-dessus → ≈ 0.909", () => {
      const score = service.calculateExpectedScore(1400, 1000);
      expect(score).toBeCloseTo(1 / (1 + Math.pow(10, -1)), 5);
    });

    it("joueur 400pts en-dessous → ≈ 0.091", () => {
      const score = service.calculateExpectedScore(1000, 1400);
      expect(score).toBeCloseTo(1 / (1 + Math.pow(10, 1)), 5);
    });

    it("symétrie : expectedScore(A,B) + expectedScore(B,A) = 1", () => {
      const a = service.calculateExpectedScore(1200, 800);
      const b = service.calculateExpectedScore(800, 1200);
      expect(a + b).toBeCloseTo(1, 10);
    });

    it("très grand écart → probabilité proche de 1", () => {
      const score = service.calculateExpectedScore(2000, 500);
      expect(score).toBeGreaterThan(0.99);
    });
  });

  // ── calculateEffectiveK ────────────────────────────────────────────────────

  describe("calculateEffectiveK", () => {
    it("sans modificateur → retourne kBase", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, null)).toBe(32);
    });

    it("match de placement → k × 2", () => {
      expect(service.calculateEffectiveK(32, 0, 0, true, false, null)).toBe(64);
    });

    it("score compte, victoire nette 10-0 → k × 2", () => {
      // winner=10, loser=0, total=10 → multiplier = 1 + 10/10 = 2
      expect(service.calculateEffectiveK(32, 10, 0, false, true, null)).toBe(64);
    });

    it("score compte, victoire 7-3 → k × 1.4", () => {
      // winner=7, loser=3, total=10 → multiplier = 1 + 4/10 = 1.4
      expect(service.calculateEffectiveK(32, 7, 3, false, true, null)).toBeCloseTo(44.8);
    });

    it("score compte, égalité 5-5 → k inchangé", () => {
      // winner=5, loser=5, diff=0 → multiplier = 1
      expect(service.calculateEffectiveK(32, 5, 5, false, true, null)).toBe(32);
    });

    it("score compte, total=0 (pas de scores saisis) → k inchangé", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, true, null)).toBe(32);
    });

    it("score non activé → k inchangé peu importe les scores", () => {
      expect(service.calculateEffectiveK(32, 10, 0, false, false, null)).toBe(32);
    });

    it("outcomePoints=3 (défaut) → multiplicateur 1.0, k inchangé", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, 3)).toBe(32);
    });

    it("outcomePoints=1 (forfait) → k × 1/3", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, 1)).toBeCloseTo(32 / 3);
    });

    it("outcomePoints=6 → k × 2", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, 6)).toBe(64);
    });

    it("outcomePoints=0 → k=0 (match sans impact MMR)", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, 0)).toBe(0);
    });

    it("outcomePoints=null → aucun multiplicateur", () => {
      expect(service.calculateEffectiveK(32, 0, 0, false, false, null)).toBe(32);
    });

    it("placement + score 10-0 + outcomePoints=6 → tous les multiplicateurs s'appliquent", () => {
      // k=32 → placement: 64 → score 10-0: 128 → outcome ×2: 256
      expect(service.calculateEffectiveK(32, 10, 0, true, true, 6)).toBe(256);
    });

    it("placement seul n'active pas le multiplicateur score", () => {
      const withScore = service.calculateEffectiveK(32, 10, 0, false, true, null);
      const placement = service.calculateEffectiveK(32, 0, 0, true, false, null);
      // Different modifiers, no unwanted stacking
      expect(withScore).toBe(64); // score only
      expect(placement).toBe(64); // placement uniquement
    });
  });

  // ── calculateMmrDelta ──────────────────────────────────────────────────────

  describe("calculateMmrDelta", () => {
    it("victoire vs adversaire égal → delta positif", () => {
      const delta = service.calculateMmrDelta(1000, 1000, 1, 32);
      expect(delta).toBeGreaterThan(0);
    });

    it("défaite vs adversaire égal → delta négatif", () => {
      const delta = service.calculateMmrDelta(1000, 1000, 0, 32);
      expect(delta).toBeLessThan(0);
    });

    it("nul vs adversaire égal → delta ≈ 0", () => {
      const delta = service.calculateMmrDelta(1000, 1000, 0.5, 32);
      expect(delta).toBe(0);
    });

    it("victoire vs adversaire beaucoup plus fort → grand delta positif", () => {
      const deltaVsStrong = service.calculateMmrDelta(1000, 1400, 1, 32);
      const deltaVsEqual = service.calculateMmrDelta(1000, 1000, 1, 32);
      expect(deltaVsStrong).toBeGreaterThan(deltaVsEqual);
    });

    it("victoire vs adversaire beaucoup plus faible → petit delta", () => {
      const deltaVsWeak = service.calculateMmrDelta(1400, 1000, 1, 32);
      const deltaVsEqual = service.calculateMmrDelta(1000, 1000, 1, 32);
      expect(deltaVsWeak).toBeLessThan(deltaVsEqual);
    });

    it("défaite vs adversaire plus fort → perte plus faible que défaite vs égal", () => {
      const lossVsStrong = service.calculateMmrDelta(1000, 1400, 0, 32);
      const lossVsEqual = service.calculateMmrDelta(1000, 1000, 0, 32);
      expect(Math.abs(lossVsStrong)).toBeLessThan(Math.abs(lossVsEqual));
    });

    it("K=0 → delta=0 (match ignoré pour le MMR)", () => {
      expect(service.calculateMmrDelta(1000, 1000, 1, 0)).toBe(0);
    });

    it("delta est un entier (arrondi)", () => {
      const delta = service.calculateMmrDelta(1050, 980, 1, 32);
      expect(Number.isInteger(delta)).toBe(true);
    });

    it("symétrie approximative : delta victoire + delta défaite ≈ 0 pour égaux", () => {
      const win = service.calculateMmrDelta(1000, 1000, 1, 32);
      const loss = service.calculateMmrDelta(1000, 1000, 0, 32);
      // With rounding, the difference can be ±1
      expect(Math.abs(win + loss)).toBeLessThanOrEqual(1);
    });
  });

  // ── recalculatePlayerMmr ───────────────────────────────────────────────────

  describe("recalculatePlayerMmr", () => {
    const SEASON = "season-1";
    const PLAYER = "player-1";

    function setupMatches(
      matches: Array<{ id: string; outcomeType: { scoreCountsForMmr: boolean; points: number } | null }>,
      sideResults: Record<string, ReturnType<typeof makeSideResult>>,
    ) {
      (service as any).getPlayerMatchesForSeason = async () => matches;
      (service as any).preloadMatchSides = async (matchIds: string[]) => {
        const map = new Map();
        for (const id of matchIds) map.set(id, sideResults[id] ?? makeSideResult({ playerWon: null }));
        return map;
      };
    }

    it("aucun match → supprime l'entrée MMR, pas d'upsert", async () => {
      setupMatches([], {});
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(mockPlayerMmrRepo.deleteBySeasonAndPlayer.mock.calls.length).toBe(1);
      expect(mockPlayerMmrRepo.upsert.mock.calls.length).toBe(0);
    });

    it("1 victoire → wins=1, losses=0, MMR > baseMmr", async () => {
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].wins).toBe(1);
      expect(call[0].losses).toBe(0);
      expect(call[0].currentMmr).toBeGreaterThan(1000);
    });

    it("1 défaite → losses=1, wins=0, MMR < baseMmr", async () => {
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: false }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].losses).toBe(1);
      expect(call[0].wins).toBe(0);
      expect(call[0].currentMmr).toBeLessThan(1000);
    });

    it("3 victoires consécutives → winStreak=3, maxWinStreak=3", async () => {
      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3")],
        {
          m1: makeSideResult({ playerWon: true }),
          m2: makeSideResult({ playerWon: true }),
          m3: makeSideResult({ playerWon: true }),
        },
      );
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].winStreak).toBe(3);
      expect(call[0].maxWinStreak).toBe(3);
    });

    it("3 victoires puis 1 défaite → winStreak=0, maxWinStreak=3", async () => {
      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3"), makeMatch("m4")],
        {
          m1: makeSideResult({ playerWon: true }),
          m2: makeSideResult({ playerWon: true }),
          m3: makeSideResult({ playerWon: true }),
          m4: makeSideResult({ playerWon: false }),
        },
      );
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].winStreak).toBe(0);
      expect(call[0].maxWinStreak).toBe(3);
    });

    it("victoire, défaite, 2 victoires → winStreak=2, maxWinStreak=2", async () => {
      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3"), makeMatch("m4")],
        {
          m1: makeSideResult({ playerWon: true }),
          m2: makeSideResult({ playerWon: false }),
          m3: makeSideResult({ playerWon: true }),
          m4: makeSideResult({ playerWon: true }),
        },
      );
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].winStreak).toBe(2);
      expect(call[0].maxWinStreak).toBe(2);
    });

    it("les nuls comptent comme draw et dans matchesPlayed, pas dans wins/losses", async () => {
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: null }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].wins).toBe(0);
      expect(call[0].losses).toBe(0);
      expect(call[0].draws).toBe(1);
      expect(call[0].matchesPlayed).toBe(1);
    });

    it("MMR plancher à 1 (pas de MMR négatif)", async () => {
      mockRankedRepo.getConfigByTournamentId.mockImplementation(() =>
        Promise.resolve({ ...DEFAULT_CONFIG, baseMmr: 10, kFactor: 200 }),
      );

      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3")],
        {
          m1: makeSideResult({ playerWon: false }),
          m2: makeSideResult({ playerWon: false }),
          m3: makeSideResult({ playerWon: false }),
        },
      );

      mockPlayerMmrRepo.getBySeasonAndPlayer.mockImplementation(() =>
        Promise.resolve({ currentMmr: 1200 }),
      );

      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].currentMmr).toBeGreaterThanOrEqual(1);
    });

    it("les N premiers matchs sont placement (K doublé)", async () => {
      mockRankedRepo.getConfigByTournamentId.mockImplementation(() =>
        Promise.resolve({ ...DEFAULT_CONFIG, placementMatches: 2 }),
      );

      const historyArgs: any[] = [];
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyArgs.push(args);
        return Promise.resolve();
      });

      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3")],
        {
          m1: makeSideResult({ playerWon: true }),
          m2: makeSideResult({ playerWon: true }),
          m3: makeSideResult({ playerWon: true }),
        },
      );

      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(historyArgs[0].isPlacement).toBe(true);  // match 1 (0 played before)
      expect(historyArgs[1].isPlacement).toBe(true);  // match 2 (1 played before)
      expect(historyArgs[2].isPlacement).toBe(false); // match 3 (2 played before ≥ placementMatches)
    });

    it("historique MMR créé pour chaque match", async () => {
      setupMatches(
        [makeMatch("m1"), makeMatch("m2"), makeMatch("m3")],
        {
          m1: makeSideResult({ playerWon: true }),
          m2: makeSideResult({ playerWon: false }),
          m3: makeSideResult({ playerWon: true }),
        },
      );
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(mockPlayerMmrRepo.createMmrHistory.mock.calls).toHaveLength(3); // reset in beforeEach
    });

    it("historique contient mmrBefore/mmrAfter/delta cohérents", async () => {
      const historyArgs: any[] = [];
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyArgs.push(args);
        return Promise.resolve();
      });

      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const entry = historyArgs[0];
      expect(entry.mmrBefore).toBe(1000);
      expect(entry.mmrAfter).toBe(entry.mmrBefore + entry.mmrDelta);
      expect(entry.mmrDelta).toBeGreaterThan(0);
    });

    it("outcomeType forfait (points=1) → delta plus faible qu'une victoire normale", async () => {
      const historyFormatNormal: any[] = [];
      const historyFormatForfeit: any[] = [];

      // Normal win (no outcome type → no points multiplier)
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyFormatNormal.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1", null)], {
        m1: makeSideResult({ playerWon: true }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      resetMocks();
      service = new MmrCalculationService();

      // Forfait win (points=1)
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyFormatForfeit.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1", { scoreCountsForMmr: false, points: 1 })], {
        m1: makeSideResult({ playerWon: true }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(historyFormatForfeit[0].mmrDelta).toBeLessThan(historyFormatNormal[0].mmrDelta);
    });

    it("outcomeType points=0 → delta=0 (match ignoré pour le MMR)", async () => {
      const historyArgs: any[] = [];
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyArgs.push(args);
        return Promise.resolve();
      });

      setupMatches([makeMatch("m1", { scoreCountsForMmr: false, points: 0 })], {
        m1: makeSideResult({ playerWon: true }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(historyArgs[0].mmrDelta).toBe(0);
    });

    it("symétrie vainqueur/perdant : utilise mmrBefore adversaire depuis history si disponible", async () => {
      const winnerHistory: any[] = [];
      const loserHistory: any[] = [];

      // Process winner: opponent "opp-1" has no history → falls back to currentMmr=1000
      mockPlayerMmrRepo.getPlayerCurrentMmrs.mockImplementation(() =>
        Promise.resolve(new Map([["opp-1", 1000]])),
      );
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        winnerHistory.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], { m1: makeSideResult({ playerWon: true, opponentPlayerIds: ["opp-1"] }) });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      resetMocks();
      service = new MmrCalculationService();

      // Process loser: opponent "winner-1" has history entry showing mmrBefore=1000
      mockPlayerMmrRepo.preloadOpponentHistories.mockImplementation(() =>
        Promise.resolve(new Map([["winner-1:m1", 1000]])),
      );
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        loserHistory.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], { m1: makeSideResult({ playerWon: false, opponentPlayerIds: ["winner-1"] }) });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      // Both opponents had mmrBefore=1000, so |winDelta| and |lossDelta| should be equal
      expect(Math.abs(winnerHistory[0].mmrDelta)).toBe(Math.abs(loserHistory[0].mmrDelta));
    });

    it("kEffective dans l'historique est amplifié quand score nette et scoreCountsForMmr=true", async () => {
      const historyNoScore: any[] = [];
      const historyWithScore: any[] = [];

      // Win with no score (0-0, total=0 → no amplification)
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyNoScore.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true, scoreForPlayer: 0, scoreForOpponent: 0 }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      resetMocks();
      service = new MmrCalculationService();

      // Lopsided win 10-0 → maximum amplification (diff/total = 1)
      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyWithScore.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true, scoreForPlayer: 10, scoreForOpponent: 0 }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(historyWithScore[0].kEffective).toBeGreaterThan(historyNoScore[0].kEffective);
    });

    it("mmrDelta plus élevé pour score 10-0 que pour score 5-5 avec scoreCountsForMmr=true", async () => {
      const historyDraw: any[] = [];
      const historyDomination: any[] = [];

      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyDraw.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true, scoreForPlayer: 5, scoreForOpponent: 5 }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      resetMocks();
      service = new MmrCalculationService();

      mockPlayerMmrRepo.createMmrHistory.mockImplementation((args: any) => {
        historyDomination.push(args);
        return Promise.resolve();
      });
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: true, scoreForPlayer: 10, scoreForOpponent: 0 }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(historyDomination[0].mmrDelta).toBeGreaterThan(historyDraw[0].mmrDelta);
    });

    it("retourne immédiatement si pas de config ranked", async () => {
      mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve(null));
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(mockPlayerMmrRepo.upsert.mock.calls).toHaveLength(0);
    });
  });

  // ── Combined scenarios ─────────────────────────────────────────────────────

  describe("scénarios combinés K factor", () => {
    it("victoire écrasante en placement avec outcome premium → K maximal", () => {
      // kBase=32, placement ×2, score 10-0 ×2, points=6 ×2 → 32×8=256
      const k = service.calculateEffectiveK(32, 10, 0, true, true, 6);
      expect(k).toBe(256);
    });

    it("forfait sans score en placement → seul le placement s'applique", () => {
      // kBase=32, placement ×2, scoreCountsForMmr=false, points=1 →  32×2 × 1/3 ≈ 21.3
      const k = service.calculateEffectiveK(32, 0, 0, true, false, 1);
      expect(k).toBeCloseTo((32 * 2) / 3);
    });

    it("match normal (defaults) → K inchangé", () => {
      // isPlacement=false, scoreCountsForMmr=true mais 0-0, outcomePoints=3
      const k = service.calculateEffectiveK(32, 0, 0, false, true, 3);
      expect(k).toBe(32);
    });
  });

  // ── calculateMatchMmrBySides ───────────────────────────────────────────────

  describe("calculateMatchMmrBySides", () => {
    function makeOutcomeType(overrides: Partial<{ scoreCountsForMmr: boolean; mmrMultiplier: number; points: number }> = {}) {
      return { id: "", disciplineId: "", name: "", isDefault: false, scoreCountsForMmr: true, points: 3, mmrMultiplier: 1, ...overrides };
    }

    const discipline = { id: "", name: "", teamInteractionMode: null };

    it("scoreCountsForMmr=false → delta=0 pour tous (early return)", () => {
      const results = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType({ scoreCountsForMmr: false }),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }], score: 10 },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }], score: 0 },
        ],
      });
      expect(results.every((r) => r.mmrDelta === 0)).toBe(true);
    });

    it("score amplifié 10-0 → delta vainqueur plus élevé qu'avec score 5-5", () => {
      const resultDraw = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }], score: 5 },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }], score: 5 },
        ],
      });
      const resultDomination = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }], score: 10 },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }], score: 0 },
        ],
      });
      const winnerDraw = resultDraw.find((r) => r.playerId === "p1")!;
      const winnerDomination = resultDomination.find((r) => r.playerId === "p1")!;
      expect(winnerDomination.mmrDelta).toBeGreaterThan(winnerDraw.mmrDelta);
    });

    it("score 0-0 avec scoreCountsForMmr=true → même delta que sans score (total=0 → pas d'amplification)", () => {
      const resultNoScore = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      const resultZero = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }], score: 0 },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }], score: 0 },
        ],
      });
      expect(resultZero.find((r) => r.playerId === "p1")!.mmrDelta).toBe(
        resultNoScore.find((r) => r.playerId === "p1")!.mmrDelta,
      );
    });

    it("score égal 5-5 → même delta que sans score (diff=0 → pas d'amplification)", () => {
      const resultNoScore = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      const resultEqual = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }], score: 5 },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }], score: 5 },
        ],
      });
      expect(resultEqual.find((r) => r.playerId === "p1")!.mmrDelta).toBe(
        resultNoScore.find((r) => r.playerId === "p1")!.mmrDelta,
      );
    });

    it("mmrMultiplier=2 → delta doublé", () => {
      const result1 = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType({ mmrMultiplier: 1 }),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      const result2 = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType({ mmrMultiplier: 2 }),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      expect(result2.find((r) => r.playerId === "p1")!.mmrDelta).toBe(
        result1.find((r) => r.playerId === "p1")!.mmrDelta * 2,
      );
    });

    it("mmrMultiplier=0 → delta=0 pour tous", () => {
      const results = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType({ mmrMultiplier: 0 }),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      expect(results.every((r) => r.mmrDelta === 0)).toBe(true);
    });

    it("vainqueur newMmr > currentMmr, perdant newMmr < currentMmr", () => {
      const results = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1000 }] },
        ],
      });
      expect(results.find((r) => r.playerId === "p1")!.newMmr).toBeGreaterThan(1000);
      expect(results.find((r) => r.playerId === "p2")!.newMmr).toBeLessThan(1000);
    });

    it("newMmr plancher à 1 même si currentMmr très bas et kFactor élevé", () => {
      const results = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 2000 }] },
          { isWinner: false, players: [{ id: "p2", currentMmr: 1 }] },
        ],
        kFactor: 500,
      });
      expect(results.find((r) => r.playerId === "p2")!.newMmr).toBeGreaterThanOrEqual(1);
    });

    it("somme des deltas de tous les joueurs ≈ 0 (conservation, à l'arrondi près)", () => {
      const results = service.calculateMatchMmrBySides({
        discipline,
        outcomeType: makeOutcomeType(),
        sides: [
          { isWinner: true, players: [{ id: "p1", currentMmr: 1000 }, { id: "p2", currentMmr: 1000 }] },
          { isWinner: false, players: [{ id: "p3", currentMmr: 1000 }, { id: "p4", currentMmr: 1000 }] },
        ],
      });
      const total = results.reduce((s, r) => s + r.mmrDelta, 0);
      expect(Math.abs(total)).toBeLessThanOrEqual(results.length);
    });
  });

  // ── ensurePlayerMmrExists ──────────────────────────────────────────────────

  describe("ensurePlayerMmrExists", () => {
    it("joueur déjà existant → pas d'upsert", async () => {
      mockPlayerMmrRepo.getBySeasonAndPlayer.mockImplementation(() =>
        Promise.resolve({ currentMmr: 1000 }),
      );
      await (service as any).ensurePlayerMmrExists("s1", 1000, "p1");
      expect(mockPlayerMmrRepo.upsert.mock.calls).toHaveLength(0);
    });

    it("joueur absent → upsert avec baseMmr et compteurs à zéro", async () => {
      await (service as any).ensurePlayerMmrExists("s1", 800, "p1");
      expect(mockPlayerMmrRepo.upsert.mock.calls).toHaveLength(1);
      expect(mockPlayerMmrRepo.upsert.mock.calls[0][0]).toMatchObject({
        seasonId: "s1",
        playerId: "p1",
        currentMmr: 800,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winStreak: 0,
        maxWinStreak: 0,
      });
    });

    it("joueur repris de la saison précédente → upsert au MMR seedé, pas au baseMmr", async () => {
      mockMmrSeedRepo.getSeedMmr.mockImplementation(() => Promise.resolve(1180));
      await (service as any).ensurePlayerMmrExists("s1", 1000, "p1");
      expect(mockPlayerMmrRepo.upsert.mock.calls[0][0]).toMatchObject({ currentMmr: 1180 });
    });
  });

  // ── MMR d'entrée repris de la saison précédente ─────────────────────────────

  describe("carried-over entry MMR", () => {
    it("recalculatePlayerMmr → le 1er match part du MMR seedé, pas de baseMmr", async () => {
      mockMmrSeedRepo.getMapBySeason.mockImplementation(() =>
        Promise.resolve(new Map([["p1", 1180]])),
      );
      (service as any).getPlayerMatchesForSeason = async () => [makeMatch("m1")];
      (service as any).preloadMatchSides = async () =>
        new Map([["m1", makeSideResult({ playerWon: false })]]);

      await service.recalculatePlayerMmr("s1", "p1");

      // Une défaite depuis 1180 laisse le joueur au-dessus de baseMmr : un départ à
      // baseMmr l'aurait fait finir en dessous.
      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].currentMmr).toBeGreaterThan(1000);
      expect(call[0].currentMmr).toBeLessThan(1180);
      const history = mockPlayerMmrRepo.createMmrHistory.mock.calls.at(-1)!;
      expect(history[0].mmrBefore).toBe(1180);
    });

    it("recalculateSeasonMmrDeterministic → le replay démarre au MMR seedé", async () => {
      mockMmrSeedRepo.getMapBySeason.mockImplementation(() =>
        Promise.resolve(new Map([["p1", 1180], ["p2", 820]])),
      );
      let served = false;
      mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mockImplementation(() => {
        if (served) return Promise.resolve([]);
        served = true;
        return Promise.resolve([
          {
            id: "m1",
            playedAt: new Date("2026-01-01T10:00:00Z"),
            winnerSide: "A",
            outcomeType: { scoreCountsForMmr: true, points: 3, mmrMultiplier: 1, discipline: null },
            sides: [
              { score: 0, entry: { players: [{ playerId: "p1" }] } },
              { score: 0, entry: { players: [{ playerId: "p2" }] } },
            ],
          },
        ]);
      });

      await service.recalculateSeasonMmrDeterministic("s1");

      const history = mockPlayerMmrRepo.createMmrHistoryBatch.mock.calls[0][0] as any[];
      const p1 = history.find((row) => row.playerId === "p1");
      const p2 = history.find((row) => row.playerId === "p2");
      expect(p1.mmrBefore).toBe(1180);
      expect(p2.mmrBefore).toBe(820);
      // Le favori gagne : le gain est plus faible que celui d'un match équilibré.
      expect(p1.mmrDelta).toBeGreaterThan(0);
      expect(p2.mmrDelta).toBeLessThan(0);
    });
  });

  // ── getMatchPlayerIds ──────────────────────────────────────────────────────

  describe("getMatchPlayerIds", () => {
    it("aucun résultat → tableau vide", async () => {
      setSelectResult([]);
      const result = await (service as any).getMatchPlayerIds("m1");
      expect(result).toEqual([]);
    });

    it("déduplique les playerIds", async () => {
      setSelectResult([{ playerId: "p1" }, { playerId: "p2" }, { playerId: "p1" }]);
      const result = await (service as any).getMatchPlayerIds("m1");
      expect(result).toEqual(["p1", "p2"]);
    });

    it("db.select appelé une fois", async () => {
      setSelectResult([{ playerId: "p1" }]);
      await (service as any).getMatchPlayerIds("m1");
      expect(mockDb.select.mock.calls).toHaveLength(1);
    });
  });

  // ── getPlayerMatchesForSeason ──────────────────────────────────────────────

  describe("getPlayerMatchesForSeason", () => {
    it("aucun matchId trouvé → retourne [] sans appeler findMany", async () => {
      setSelectResult([]);
      const result = await (service as any).getPlayerMatchesForSeason("s1", "p1");
      expect(result).toEqual([]);
      expect(mockDb.query.matches.findMany.mock.calls).toHaveLength(0);
    });

    it("matchIds trouvés → appelle findMany et retourne ses résultats", async () => {
      setSelectResult([{ matchId: "m1" }, { matchId: "m2" }]);
      mockDb.query.matches.findMany.mockImplementation(() =>
        Promise.resolve([{ id: "m1" }, { id: "m2" }]),
      );
      const result = await (service as any).getPlayerMatchesForSeason("s1", "p1");
      expect(result).toHaveLength(2);
      expect(mockDb.query.matches.findMany.mock.calls).toHaveLength(1);
    });
  });

  // ── extractMatchSidesForPlayer ─────────────────────────────────────────────

  describe("extractMatchSidesForPlayer", () => {
    function makeRawSides(
      playerIdsA: string[],
      playerIdsB: string[],
      scoreA: number,
      scoreB: number,
    ) {
      return [
        { position: 1, score: scoreA, entry: { players: playerIdsA.map((id) => ({ playerId: id })) } },
        { position: 2, score: scoreB, entry: { players: playerIdsB.map((id) => ({ playerId: id })) } },
      ];
    }

    const DEFAULTS = { opponentPlayerIds: [], scoreForPlayer: 0, scoreForOpponent: 0, playerWon: null };

    it("match introuvable → valeurs par défaut", async () => {
      mockDb.query.matchSides.findMany.mockImplementation(() =>
        Promise.resolve(makeRawSides(["p1"], ["p2"], 3, 1)),
      );
      // findFirst already returns null by default
      const result = await (service as any).extractMatchSidesForPlayer("m1", "p1");
      expect(result).toEqual(DEFAULTS);
    });

    it("moins de 2 sides → valeurs par défaut", async () => {
      mockDb.query.matchSides.findMany.mockImplementation(() => Promise.resolve([]));
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({ id: "m1", winnerSide: "A" }),
      );
      const result = await (service as any).extractMatchSidesForPlayer("m1", "p1");
      expect(result).toEqual(DEFAULTS);
    });

    it("joueur en side A, winnerSide A → playerWon=true, bons scores", async () => {
      mockDb.query.matchSides.findMany.mockImplementation(() =>
        Promise.resolve(makeRawSides(["p1"], ["p2"], 3, 1)),
      );
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({ id: "m1", winnerSide: "A" }),
      );
      const result = await (service as any).extractMatchSidesForPlayer("m1", "p1");
      expect(result.playerWon).toBe(true);
      expect(result.scoreForPlayer).toBe(3);
      expect(result.scoreForOpponent).toBe(1);
      expect(result.opponentPlayerIds).toEqual(["p2"]);
    });

    it("joueur en side B, winnerSide A → playerWon=false, scores inversés", async () => {
      mockDb.query.matchSides.findMany.mockImplementation(() =>
        Promise.resolve(makeRawSides(["p1"], ["p2"], 3, 1)),
      );
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({ id: "m1", winnerSide: "A" }),
      );
      const result = await (service as any).extractMatchSidesForPlayer("m1", "p2");
      expect(result.playerWon).toBe(false);
      expect(result.scoreForPlayer).toBe(1);
      expect(result.scoreForOpponent).toBe(3);
      expect(result.opponentPlayerIds).toEqual(["p1"]);
    });

    it("winnerSide null → playerWon=null (nul / pas de résultat)", async () => {
      mockDb.query.matchSides.findMany.mockImplementation(() =>
        Promise.resolve(makeRawSides(["p1"], ["p2"], 2, 2)),
      );
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({ id: "m1", winnerSide: null }),
      );
      const result = await (service as any).extractMatchSidesForPlayer("m1", "p1");
      expect(result.playerWon).toBeNull();
    });
  });

  // ── processMatchFinalization ───────────────────────────────────────────────

  describe("processMatchFinalization", () => {
    function stubPrivates(svc: MmrCalculationService, playerIds: string[]) {
      (svc as any).getMatchPlayerIds = mock(async () => playerIds);
      (svc as any).ensurePlayerMmrExists = mock(async () => {});
      (svc as any).recalculatePlayerMmr = mock(async () => {});
    }

    it("match introuvable → retour immédiat, aucun appel downstream, Map vide", async () => {
      stubPrivates(service, []);
      const result = await service.processMatchFinalization("m1");
      expect((service as any).getMatchPlayerIds.mock.calls).toHaveLength(0);
      expect(result.size).toBe(0);
    });

    it("tournoi non ranked → retour immédiat", async () => {
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: "m1",
          tournamentId: "s1",
          tournament: { mode: "league", rankedConfig: null },
        }),
      );
      stubPrivates(service, []);
      await service.processMatchFinalization("m1");
      expect((service as any).getMatchPlayerIds.mock.calls).toHaveLength(0);
    });

    it("match ranked, 2 joueurs → recalculate appelé pour chacun via la cascade", async () => {
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: "m1",
          tournamentId: "s1",
          playedAt: new Date("2024-01-01"),
          tournament: { mode: "ranked", rankedConfig: { baseMmr: 1000 } },
        }),
      );
      stubPrivates(service, ["p1", "p2"]);
      const result = await service.processMatchFinalization("m1");
      expect((service as any).ensurePlayerMmrExists.mock.calls).toHaveLength(2);
      expect((service as any).recalculatePlayerMmr.mock.calls).toHaveLength(2);
      // Direct participants are tagged "match_finalized" (not "match_cancelled")
      // — proves processMatchFinalization now goes through the generic cascade
      // with its own reason, not a copy-pasted cancellation code path.
      expect(result.get("p1")?.reason).toBe("match_finalized");
      expect(result.get("p2")?.reason).toBe("match_finalized");
    });

    it("rankedConfig null → baseMmr fallback à 1000 pour ensurePlayerMmrExists", async () => {
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: "m1",
          tournamentId: "s1",
          tournament: { mode: "ranked", rankedConfig: null },
        }),
      );
      stubPrivates(service, ["p1"]);
      await service.processMatchFinalization("m1");
      expect((service as any).ensurePlayerMmrExists.mock.calls[0][1]).toBe(1000);
    });

  });

  // ── cascadeRecalculateFromMatch (via cascadeRecalculateAfterCancellation) ──
  // No coverage existed anywhere in the repo for the wave-propagation cascade
  // before this fix (confirmed by search). This exercises the orchestration:
  // direct participants first, then a third party found by findAffectedPlayers,
  // tagged with the right reasons, until the wave loop finds nothing left to change.

  describe("cascadeRecalculateFromMatch", () => {
    it("recalcule un tiers affecté renvoyé par findAffectedPlayers et le tague 'cascade'", async () => {
      const playerMmrStore: Record<string, number> = { p1: 1000, p2: 1000, p3: 1000 };

      mockPlayerMmrRepo.getBySeasonAndPlayer.mockImplementation((...args: any[]) =>
        Promise.resolve({ currentMmr: playerMmrStore[args[1] as string] }),
      );
      mockPlayerMmrRepo.upsert.mockImplementation((args: any) => {
        playerMmrStore[args.playerId] = args.currentMmr;
        return Promise.resolve(args);
      });

      (service as any).getMatchPlayerIds = mock(async () => ["p1", "p2"]);

      const matchesByPlayer: Record<string, ReturnType<typeof makeMatch>[]> = {
        p1: [makeMatch("m1")],
        p2: [makeMatch("m1")],
        p3: [makeMatch("m2")],
      };
      const sideByPlayer: Record<string, ReturnType<typeof makeSideResult>> = {
        p1: makeSideResult({ playerWon: true, opponentPlayerIds: ["p2"] }),
        p2: makeSideResult({ playerWon: false, opponentPlayerIds: ["p1"] }),
        p3: makeSideResult({ playerWon: true, opponentPlayerIds: ["p1"] }),
      };
      (service as any).getPlayerMatchesForSeason = async (_seasonId: string, playerId: string) =>
        matchesByPlayer[playerId] ?? [];
      (service as any).preloadMatchSides = async (matchIds: string[], playerId: string) => {
        const map = new Map();
        for (const id of matchIds) map.set(id, sideByPlayer[playerId] ?? makeSideResult({ playerWon: null }));
        return map;
      };

      let findAffectedCalls = 0;
      (service as any).findAffectedPlayers = mock(async () => {
        findAffectedCalls++;
        return findAffectedCalls === 1 ? ["p3"] : [];
      });

      const result = await service.cascadeRecalculateAfterCancellation("m1", "s1", new Date("2024-01-01T00:00:00Z"));

      // 2 calls: 1st finds p3 after the direct wave changes p1/p2, 2nd (after
      // p3's own wave) finds nothing left → loop stops.
      expect((service as any).findAffectedPlayers.mock.calls).toHaveLength(2);
      expect((service as any).findAffectedPlayers.mock.calls[0][1]).toEqual(["p1", "p2"]);
      expect(result.get("p1")?.reason).toBe("match_cancelled");
      expect(result.get("p2")?.reason).toBe("match_cancelled");
      expect(result.get("p3")?.reason).toBe("cascade");
      expect(playerMmrStore.p3).not.toBe(1000); // p3 was actually recalculated, not skipped
    });

    it("aucun changement direct → findAffectedPlayers jamais appelé", async () => {
      (service as any).getMatchPlayerIds = mock(async () => ["p1", "p2"]);
      (service as any).recalculatePlayerMmr = mock(async () => {}); // no-op: mmr never actually changes
      (service as any).findAffectedPlayers = mock(async () => ["should-not-be-reached"]);

      await service.cascadeRecalculateAfterCancellation("m1", "s1", new Date("2024-01-01T00:00:00Z"));

      expect((service as any).findAffectedPlayers.mock.calls).toHaveLength(0);
    });
  });

  // ── recalculateSeasonMmrDeterministic ─────────────────────────────────────

  describe("recalculateSeasonMmrDeterministic", () => {
    function makeGlobalMatch(opts: {
      id: string;
      playedAt: string;
      sideAIds: string[];
      sideBIds: string[];
      winnerSide: string | null;
      scoreA?: number | null;
      scoreB?: number | null;
      outcomeType?: { scoreCountsForMmr: boolean; points: number; mmrMultiplier?: number; discipline?: any } | null;
    }) {
      return {
        id: opts.id,
        playedAt: new Date(opts.playedAt),
        winnerSide: opts.winnerSide,
        outcomeType: opts.outcomeType ?? null,
        sides: [
          { position: 1, score: opts.scoreA ?? null, entry: { players: opts.sideAIds.map((id) => ({ playerId: id })) } },
          { position: 2, score: opts.scoreB ?? null, entry: { players: opts.sideBIds.map((id) => ({ playerId: id })) } },
        ],
      };
    }

    // Simulates the real keyset-paginated repository method against an
    // in-memory, already playedAt/id-sorted fixture list.
    function makePaginator(sortedMatches: ReturnType<typeof makeGlobalMatch>[]) {
      return (_seasonId: string, cursor: { playedAt: Date; id: string } | undefined, pageSize: number) => {
        let startIdx = 0;
        if (cursor) {
          const idx = sortedMatches.findIndex((m) => m.id === cursor.id);
          startIdx = idx + 1;
        }
        return Promise.resolve(sortedMatches.slice(startIdx, startIdx + pageSize));
      };
    }

    it("1 match 1v1, victoire p1 → historique + upsert pour les deux joueurs, deltas opposés", async () => {
      const matches = [
        makeGlobalMatch({ id: "m1", playedAt: "2024-01-01T00:00:00Z", sideAIds: ["p1"], sideBIds: ["p2"], winnerSide: "A" }),
      ];
      mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mockImplementation(makePaginator(matches));

      const historyBatches: any[][] = [];
      mockPlayerMmrRepo.createMmrHistoryBatch.mockImplementation((rows: any[]) => {
        historyBatches.push(rows);
        return Promise.resolve();
      });
      const upserts: any[] = [];
      mockPlayerMmrRepo.upsert.mockImplementation((args: any) => {
        upserts.push(args);
        return Promise.resolve();
      });

      await service.recalculateSeasonMmrDeterministic("s1");

      expect(mockPlayerMmrRepo.deleteAllMmrHistoryForSeason.mock.calls).toHaveLength(1);
      expect(historyBatches[0]).toHaveLength(2);
      const p1History = historyBatches[0].find((r) => r.playerId === "p1")!;
      const p2History = historyBatches[0].find((r) => r.playerId === "p2")!;
      expect(p1History.mmrDelta).toBeGreaterThan(0);
      expect(p2History.mmrDelta).toBeLessThan(0);
      expect(upserts.find((u) => u.playerId === "p1")!.currentMmr).toBe(p1History.mmrAfter);
      expect(upserts.find((u) => u.playerId === "p2")!.currentMmr).toBe(p2History.mmrAfter);
    });

    it("joueur avec 0 match restant après recalcul → entrée player_mmr supprimée", async () => {
      mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mockImplementation(makePaginator([]));
      mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() =>
        Promise.resolve([{ playerId: "ghost-player" }]),
      );

      await service.recalculateSeasonMmrDeterministic("s1");

      expect(mockPlayerMmrRepo.deleteBySeasonAndPlayer.mock.calls).toHaveLength(1);
      expect(mockPlayerMmrRepo.deleteBySeasonAndPlayer.mock.calls[0]).toEqual(["s1", "ghost-player"]);
      expect(mockPlayerMmrRepo.upsert.mock.calls).toHaveLength(0);
    });

    it("graphe de matchs enchevêtré : résultat identique quel que soit le page size (1 vs tout en une page)", async () => {
      // p1 beats p2, p2 beats p3, p3 beats p1 — cyclic dependency between players,
      // exactly the shape that made the old per-player unordered loop diverge.
      const matches = [
        makeGlobalMatch({ id: "m1", playedAt: "2024-01-01T00:00:00Z", sideAIds: ["p1"], sideBIds: ["p2"], winnerSide: "A" }),
        makeGlobalMatch({ id: "m2", playedAt: "2024-01-02T00:00:00Z", sideAIds: ["p2"], sideBIds: ["p3"], winnerSide: "A" }),
        makeGlobalMatch({ id: "m3", playedAt: "2024-01-03T00:00:00Z", sideAIds: ["p3"], sideBIds: ["p1"], winnerSide: "A" }),
        makeGlobalMatch({ id: "m4", playedAt: "2024-01-04T00:00:00Z", sideAIds: ["p1"], sideBIds: ["p3"], winnerSide: "B" }),
      ];

      async function runWithPageSize(pageSize: number) {
        const svc = new MmrCalculationService();
        mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mockImplementation(makePaginator(matches));
        const upserts: any[] = [];
        mockPlayerMmrRepo.upsert.mockImplementation((args: any) => {
          upserts.push(args);
          return Promise.resolve();
        });
        await svc.recalculateSeasonMmrDeterministic("s1", pageSize);
        return upserts.sort((a, b) => a.playerId.localeCompare(b.playerId));
      }

      const resultSinglePage = await runWithPageSize(500);
      resetMocks();
      const resultOneMatchPerPage = await runWithPageSize(1);

      expect(resultOneMatchPerPage).toEqual(resultSinglePage);
    });

    it("aucune config ranked → retourne immédiatement, aucun appel downstream", async () => {
      mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve(null));
      await service.recalculateSeasonMmrDeterministic("s1");
      expect(mockPlayerMmrRepo.deleteAllMmrHistoryForSeason.mock.calls).toHaveLength(0);
      expect(mockPlayerMmrRepo.getFinalizedMatchesPageForSeason.mock.calls).toHaveLength(0);
    });
  });
});
