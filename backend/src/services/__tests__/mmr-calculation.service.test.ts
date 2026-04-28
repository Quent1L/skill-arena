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
  getConfigByTournamentId: mock(() => Promise.resolve(null)),
  getRankTiers: mock(() => Promise.resolve([])),
  upsertRankTier: mock(() => Promise.resolve()),
};

mock.module("../../repository/ranked-season.repository", () => ({
  rankedSeasonRepository: mockRankedRepo,
}));

const mockPlayerMmrRepo = {
  deleteMmrHistoryForPlayer: mock(() => Promise.resolve()),
  getMmrHistoryOrdered: mock(() => Promise.resolve([])),
  getBySeasonAndPlayer: mock(() => Promise.resolve(null)),
  createMmrHistory: mock(() => Promise.resolve()),
  upsert: mock(() => Promise.resolve()),
  getAllPlayersBySeasonId: mock(() => Promise.resolve([])),
};

mock.module("../../repository/player-mmr.repository", () => ({
  playerMmrRepository: mockPlayerMmrRepo,
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

  mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve(DEFAULT_CONFIG));
  mockRankedRepo.getRankTiers.mockImplementation(() => Promise.resolve([]));
  mockRankedRepo.upsertRankTier.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.deleteMmrHistoryForPlayer.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.getMmrHistoryOrdered.mockImplementation(() => Promise.resolve([]));
  mockPlayerMmrRepo.getBySeasonAndPlayer.mockImplementation(() => Promise.resolve(null));
  mockPlayerMmrRepo.createMmrHistory.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.upsert.mockImplementation(() => Promise.resolve());
  mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() => Promise.resolve([]));

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
      // Différents modificateurs, pas de cumul non désiré
      expect(withScore).toBe(64); // score uniquement
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
      // Avec l'arrondi, la différence peut être de ±1
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
      (service as any).extractMatchSidesForPlayer = async (matchId: string) =>
        sideResults[matchId] ?? makeSideResult({ playerWon: null });
    }

    it("aucun match → upsert avec baseMmr, wins=0, losses=0", async () => {
      setupMatches([], {});
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0]).toMatchObject({ currentMmr: 1000, wins: 0, losses: 0, matchesPlayed: 0 });
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

    it("les nuls ne comptent pas dans wins/losses/matchesPlayed", async () => {
      setupMatches([makeMatch("m1")], {
        m1: makeSideResult({ playerWon: null }),
      });
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      const call = mockPlayerMmrRepo.upsert.mock.calls.at(-1)!;
      expect(call[0].wins).toBe(0);
      expect(call[0].losses).toBe(0);
      expect(call[0].matchesPlayed).toBe(0);
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

      expect(historyArgs[0].isPlacement).toBe(true);  // match 1 (0 joués avant)
      expect(historyArgs[1].isPlacement).toBe(true);  // match 2 (1 joué avant)
      expect(historyArgs[2].isPlacement).toBe(false); // match 3 (2 joués avant ≥ placementMatches)
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

    it("retourne immédiatement si pas de config ranked", async () => {
      mockRankedRepo.getConfigByTournamentId.mockImplementation(() => Promise.resolve(null));
      await service.recalculatePlayerMmr(SEASON, PLAYER);

      expect(mockPlayerMmrRepo.upsert.mock.calls).toHaveLength(0);
    });
  });

  // ── Scénarios combinés ─────────────────────────────────────────────────────

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

  // ── recalculateBoundaries ──────────────────────────────────────────────────

  describe("recalculateBoundaries", () => {
    it("aucun tier → retourne sans appeler upsertRankTier", async () => {
      mockRankedRepo.getRankTiers.mockImplementation(() => Promise.resolve([]));
      await (service as any).recalculateBoundaries("s1", 1000);
      expect(mockRankedRepo.upsertRankTier.mock.calls).toHaveLength(0);
    });

    it("tiers présents, aucun joueur → tous les tiers reçoivent baseMmr", async () => {
      mockRankedRepo.getRankTiers.mockImplementation(() =>
        Promise.resolve([
          { level: 1, percentile: 0 },
          { level: 2, percentile: 0.5 },
        ]),
      );
      mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() => Promise.resolve([]));
      await (service as any).recalculateBoundaries("s1", 1000);
      expect(mockRankedRepo.upsertRankTier.mock.calls).toHaveLength(2);
      expect(mockRankedRepo.upsertRankTier.mock.calls[0][2]).toEqual({ minMmr: 1000 });
      expect(mockRankedRepo.upsertRankTier.mock.calls[1][2]).toEqual({ minMmr: 1000 });
    });

    it("percentile=0 → toujours baseMmr même avec des joueurs", async () => {
      mockRankedRepo.getRankTiers.mockImplementation(() =>
        Promise.resolve([{ level: 1, percentile: 0 }]),
      );
      mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() =>
        Promise.resolve([{ currentMmr: 1500 }, { currentMmr: 800 }]),
      );
      await (service as any).recalculateBoundaries("s1", 1000);
      expect(mockRankedRepo.upsertRankTier.mock.calls[0][2]).toEqual({ minMmr: 1000 });
    });

    it("percentile=0.5, 4 joueurs → index 2 du tri ascendant", async () => {
      // sorted: [800, 900, 1200, 1500], Math.floor(4*0.5)=2 → sorted[2]=1200
      mockRankedRepo.getRankTiers.mockImplementation(() =>
        Promise.resolve([{ level: 2, percentile: 0.5 }]),
      );
      mockPlayerMmrRepo.getAllPlayersBySeasonId.mockImplementation(() =>
        Promise.resolve([
          { currentMmr: 1200 },
          { currentMmr: 800 },
          { currentMmr: 1500 },
          { currentMmr: 900 },
        ]),
      );
      await (service as any).recalculateBoundaries("s1", 1000);
      expect(mockRankedRepo.upsertRankTier.mock.calls[0][2]).toEqual({ minMmr: 1200 });
    });
  });

  // ── processMatchFinalization ───────────────────────────────────────────────

  describe("processMatchFinalization", () => {
    function stubPrivates(svc: MmrCalculationService, playerIds: string[]) {
      (svc as any).getMatchPlayerIds = mock(async () => playerIds);
      (svc as any).ensurePlayerMmrExists = mock(async () => {});
      (svc as any).recalculatePlayerMmr = mock(async () => {});
      (svc as any).recalculateBoundaries = mock(async () => {});
    }

    it("match introuvable → retour immédiat, aucun appel downstream", async () => {
      stubPrivates(service, []);
      await service.processMatchFinalization("m1");
      expect((service as any).getMatchPlayerIds.mock.calls).toHaveLength(0);
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

    it("match ranked, 2 joueurs → recalculate appelé pour chacun + boundaries", async () => {
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: "m1",
          tournamentId: "s1",
          tournament: { mode: "ranked", rankedConfig: { baseMmr: 1000 } },
        }),
      );
      stubPrivates(service, ["p1", "p2"]);
      await service.processMatchFinalization("m1");
      expect((service as any).ensurePlayerMmrExists.mock.calls).toHaveLength(2);
      expect((service as any).recalculatePlayerMmr.mock.calls).toHaveLength(2);
      expect((service as any).recalculateBoundaries.mock.calls).toHaveLength(1);
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

    it("seasonId et baseMmr corrects transmis à recalculateBoundaries", async () => {
      mockDb.query.matches.findFirst.mockImplementation(() =>
        Promise.resolve({
          id: "m1",
          tournamentId: "s1",
          tournament: { mode: "ranked", rankedConfig: { baseMmr: 1000 } },
        }),
      );
      stubPrivates(service, ["p1"]);
      await service.processMatchFinalization("m1");
      const call = (service as any).recalculateBoundaries.mock.calls[0];
      expect(call[0]).toBe("s1");
      expect(call[1]).toBe(1000);
    });
  });
});
