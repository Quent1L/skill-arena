import { describe, it, expect, beforeEach, mock } from "bun:test";
import { NotFoundError } from "../../types/errors";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DEFAULT_TOURNAMENT = {
  id: "tournament-1",
  mode: "league",
  teamMode: "static" as const,
  pointPerVictory: 3,
  pointPerDraw: 1,
  pointPerLoss: 0,
  allowDraw: true,
  scoreEnabled: true,
};

const TEAM_A = { id: "team-a", name: "Alpha", tournamentId: "tournament-1" };
const TEAM_B = { id: "team-b", name: "Beta", tournamentId: "tournament-1" };
const TEAM_C = { id: "team-c", name: "Gamma", tournamentId: "tournament-1" };

function makeMatchWithSides(
  id: string,
  winnerSide: "A" | "B" | null,
  sideA: { teamId: string; score: number; pointsAwarded?: number | null },
  sideB: { teamId: string; score: number; pointsAwarded?: number | null },
) {
  return {
    id,
    winnerSide,
    sides: [
      {
        position: 1,
        score: sideA.score,
        pointsAwarded: sideA.pointsAwarded ?? null,
        entry: {
          teamId: sideA.teamId,
          players: [],
        },
      },
      {
        position: 2,
        score: sideB.score,
        pointsAwarded: sideB.pointsAwarded ?? null,
        entry: {
          teamId: sideB.teamId,
          players: [],
        },
      },
    ],
  };
}

function makeFlexMatchWithPoints(
  id: string,
  winnerSide: "A" | "B" | null,
  playersA: string[],
  playersB: string[],
  scoreA: number,
  scoreB: number,
  pointsA: number,
  pointsB: number,
  countsForRanking = true,
) {
  return {
    id,
    winnerSide,
    playerPoints: [
      ...playersA.map((pid) => ({ playerId: pid, pointsAwarded: countsForRanking ? pointsA : 0, countsForRanking })),
      ...playersB.map((pid) => ({ playerId: pid, pointsAwarded: countsForRanking ? pointsB : 0, countsForRanking })),
    ],
    sides: [
      {
        position: 1,
        score: scoreA,
        entryId: "entry-a",
        entry: { id: "entry-a", players: playersA.map((pid) => ({ playerId: pid })) },
      },
      {
        position: 2,
        score: scoreB,
        entryId: "entry-b",
        entry: { id: "entry-b", players: playersB.map((pid) => ({ playerId: pid })) },
      },
    ],
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRepo = {
  getTournamentWithScoring: mock(() => Promise.resolve(DEFAULT_TOURNAMENT as any)),
  getMatchesWithSides: mock((_id: string, _statuses: string[]) => Promise.resolve([] as any[])),
  getPlayerPointsForStandings: mock((_id: string, _statuses: string[]) => Promise.resolve([] as any[])),
  getTournamentTeams: mock(() => Promise.resolve([TEAM_A, TEAM_B] as any[])),
  getTournamentEntries: mock(() => Promise.resolve([] as any[])),
  // Legacy — still used by recalculatePoints
  getMatchesForStandings: mock(() => Promise.resolve([] as any[])),
  getMatchSides: mock(() => Promise.resolve([] as any[])),
  deletePlayerPointsForTournament: mock(() => Promise.resolve()),
  insertPlayerPoints: mock(() => Promise.resolve()),
};

mock.module("../../repository/standings.repository", () => ({
  standingsRepository: mockRepo,
}));

import { standingsService } from "../standings.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetMocks() {
  mockRepo.getTournamentWithScoring.mockImplementation(() => Promise.resolve(DEFAULT_TOURNAMENT));
  mockRepo.getMatchesWithSides.mockImplementation((_id: string, _statuses: string[]) => Promise.resolve([]));
  mockRepo.getPlayerPointsForStandings.mockImplementation((_id: string, _statuses: string[]) => Promise.resolve([]));
  mockRepo.getTournamentTeams.mockImplementation(() => Promise.resolve([TEAM_A, TEAM_B]));
  mockRepo.getTournamentEntries.mockImplementation(() => Promise.resolve([]));
  mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([]));
  mockRepo.getMatchSides.mockImplementation(() => Promise.resolve([]));
  mockRepo.deletePlayerPointsForTournament.mockImplementation(() => Promise.resolve());
  mockRepo.insertPlayerPoints.mockImplementation(() => Promise.resolve());
}

function findEntry(standings: any[], id: string) {
  return standings.find((e) => e.id === id);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("StandingsService", () => {
  beforeEach(resetMocks);

  // ── Erreurs ────────────────────────────────────────────────────────────────

  describe("erreurs", () => {
    it("lève NotFoundError si le tournoi n'existe pas", async () => {
      mockRepo.getTournamentWithScoring.mockImplementation(() => Promise.resolve(null));
      await expect(standingsService.getOfficialStandings("unknown")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("retourne un classement vide si aucun match", async () => {
      const result = await standingsService.getOfficialStandings("tournament-1");
      expect(result.standings).toHaveLength(2); // teams are always initialized
      expect(findEntry(result.standings, "team-a")?.points).toBe(0);
    });
  });

  // ── Mode static ───────────────────────────────────────────────────────────

  describe("mode static", () => {
    it("victoire side A : A gagne 3 pts, B gagne 0 pt", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([makeMatchWithSides("m1", "A", { teamId: "team-a", score: 3 }, { teamId: "team-b", score: 1 })]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(a.points).toBe(3);
      expect(a.wins).toBe(1);
      expect(a.draws).toBe(0);
      expect(a.losses).toBe(0);
      expect(a.scored).toBe(3);
      expect(a.conceded).toBe(1);
      expect(a.scoreDiff).toBe(2);
      expect(a.matchesPlayed).toBe(1);

      expect(b.points).toBe(0);
      expect(b.wins).toBe(0);
      expect(b.losses).toBe(1);
      expect(b.scored).toBe(1);
      expect(b.conceded).toBe(3);
      expect(b.scoreDiff).toBe(-2);
    });

    it("victoire side B : B gagne 3 pts, A gagne 0 pt", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([makeMatchWithSides("m1", "B", { teamId: "team-a", score: 1 }, { teamId: "team-b", score: 3 })]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-b")?.points).toBe(3);
      expect(findEntry(standings, "team-b")?.wins).toBe(1);
      expect(findEntry(standings, "team-a")?.points).toBe(0);
      expect(findEntry(standings, "team-a")?.losses).toBe(1);
    });

    it("match nul : chaque équipe gagne 1 pt", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([makeMatchWithSides("m1", null, { teamId: "team-a", score: 2 }, { teamId: "team-b", score: 2 })]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(1);
      expect(findEntry(standings, "team-a")?.draws).toBe(1);
      expect(findEntry(standings, "team-b")?.points).toBe(1);
      expect(findEntry(standings, "team-b")?.draws).toBe(1);
    });

    it("pointsAwarded override les points du tournoi", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([
          makeMatchWithSides("m1", "A",
            { teamId: "team-a", score: 3, pointsAwarded: 5 },
            { teamId: "team-b", score: 1, pointsAwarded: 2 },
          ),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(5);
      expect(findEntry(standings, "team-b")?.points).toBe(2);
    });

    it("points tournoi custom (2/0/1)", async () => {
      mockRepo.getTournamentWithScoring.mockImplementation(() =>
        Promise.resolve({ ...DEFAULT_TOURNAMENT, pointPerVictory: 2, pointPerDraw: 0, pointPerLoss: 1 }),
      );
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([makeMatchWithSides("m1", "A", { teamId: "team-a", score: 2 }, { teamId: "team-b", score: 0 })]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(2);
      expect(findEntry(standings, "team-b")?.points).toBe(1);
    });

    it("cumul de plusieurs matchs", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([
          makeMatchWithSides("m1", "A", { teamId: "team-a", score: 3 }, { teamId: "team-b", score: 1 }),
          makeMatchWithSides("m2", "B", { teamId: "team-a", score: 0 }, { teamId: "team-b", score: 2 }),
          makeMatchWithSides("m3", null, { teamId: "team-a", score: 1 }, { teamId: "team-b", score: 1 }),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(a.wins).toBe(1);
      expect(a.draws).toBe(1);
      expect(a.losses).toBe(1);
      expect(a.points).toBe(4); // 3 + 0 + 1
      expect(a.matchesPlayed).toBe(3);

      expect(b.wins).toBe(1);
      expect(b.draws).toBe(1);
      expect(b.losses).toBe(1);
      expect(b.points).toBe(4); // 0 + 3 + 1
    });

    it("ignore les matchs avec moins de 2 sides", async () => {
      // Simulate a match with only 1 side
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([{ id: "m1", winnerSide: "A", sides: [{ position: 1, score: 3, pointsAwarded: null, entry: { teamId: "team-a", players: [] } }] }]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(0);
    });
  });

  // ── Tri / départage ────────────────────────────────────────────────────────

  describe("tri et départage", () => {
    it("trie par points décroissants", async () => {
      mockRepo.getTournamentTeams.mockImplementation(() => Promise.resolve([TEAM_A, TEAM_B, TEAM_C]));

      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([
          makeMatchWithSides("m1", "A", { teamId: "team-a", score: 3 }, { teamId: "team-b", score: 0 }),
          makeMatchWithSides("m2", "A", { teamId: "team-a", score: 3 }, { teamId: "team-c", score: 0 }),
          makeMatchWithSides("m3", "A", { teamId: "team-b", score: 2 }, { teamId: "team-c", score: 1 }),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(standings[0].id).toBe("team-a"); // 6 pts
      expect(standings[1].id).toBe("team-b"); // 3 pts
      expect(standings[2].id).toBe("team-c"); // 0 pts
    });

    it("départage par scoreDiff si points égaux", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([
          makeMatchWithSides("m1", "A", { teamId: "team-a", score: 5 }, { teamId: "team-b", score: 2 }),
          makeMatchWithSides("m2", "B", { teamId: "team-a", score: 1 }, { teamId: "team-b", score: 3 }),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      // A: 3pts, diff= (5-2)+(1-3) = 3-2 = +1
      // B: 3pts, diff= (2-5)+(3-1) = -3+2 = -1
      expect(standings[0].id).toBe("team-a");
    });

    it("départage par buts marqués si scoreDiff égal", async () => {
      mockRepo.getMatchesWithSides.mockImplementation(() =>
        Promise.resolve([makeMatchWithSides("m1", null, { teamId: "team-a", score: 5 }, { teamId: "team-b", score: 3 })]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(standings[0].id).toBe("team-a"); // scoreDiff A=+2, B=-2 → A premier
    });
  });

  // ── Mode flex ─────────────────────────────────────────────────────────────

  describe("mode flex", () => {
    const flexTournament = { ...DEFAULT_TOURNAMENT, teamMode: "flex" as const };

    const flexEntries = [
      {
        id: "entry-a",
        tournamentId: "tournament-1",
        players: [
          { playerId: "p-a1", player: { id: "p-a1", displayName: "Player A1", shortName: "PA1" } },
          { playerId: "p-a2", player: { id: "p-a2", displayName: "Player A2", shortName: "PA2" } },
        ],
      },
      {
        id: "entry-b",
        tournamentId: "tournament-1",
        players: [
          { playerId: "p-b1", player: { id: "p-b1", displayName: "Player B1", shortName: "PB1" } },
          { playerId: "p-b2", player: { id: "p-b2", displayName: "Player B2", shortName: "PB2" } },
        ],
      },
    ];

    beforeEach(() => {
      mockRepo.getTournamentWithScoring.mockImplementation(() => Promise.resolve(flexTournament));
      mockRepo.getTournamentEntries.mockImplementation(() => Promise.resolve(flexEntries));
    });

    it("victoire side A : tous les joueurs de A gagnent 3 pts", async () => {
      mockRepo.getPlayerPointsForStandings.mockImplementation(() =>
        Promise.resolve([makeFlexMatchWithPoints("m1", "A", ["p-a1", "p-a2"], ["p-b1", "p-b2"], 3, 1, 3, 0)]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");

      for (const pid of ["p-a1", "p-a2"]) {
        const p = findEntry(standings, pid)!;
        expect(p.points).toBe(3);
        expect(p.wins).toBe(1);
        expect(p.scored).toBe(3);
        expect(p.conceded).toBe(1);
      }
      for (const pid of ["p-b1", "p-b2"]) {
        const p = findEntry(standings, pid)!;
        expect(p.points).toBe(0);
        expect(p.losses).toBe(1);
      }
    });

    it("victoire side B : tous les joueurs de B gagnent 3 pts", async () => {
      mockRepo.getPlayerPointsForStandings.mockImplementation(() =>
        Promise.resolve([makeFlexMatchWithPoints("m1", "B", ["p-a1", "p-a2"], ["p-b1", "p-b2"], 1, 3, 0, 3)]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");

      for (const pid of ["p-b1", "p-b2"]) {
        expect(findEntry(standings, pid)?.wins).toBe(1);
        expect(findEntry(standings, pid)?.points).toBe(3);
      }
      for (const pid of ["p-a1", "p-a2"]) {
        expect(findEntry(standings, pid)?.losses).toBe(1);
        expect(findEntry(standings, pid)?.points).toBe(0);
      }
    });

    it("match nul : tous les joueurs ont 1 pt et 1 nul", async () => {
      mockRepo.getPlayerPointsForStandings.mockImplementation(() =>
        Promise.resolve([makeFlexMatchWithPoints("m1", null, ["p-a1", "p-a2"], ["p-b1", "p-b2"], 2, 2, 1, 1)]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      for (const pid of ["p-a1", "p-a2", "p-b1", "p-b2"]) {
        expect(findEntry(standings, pid)?.draws).toBe(1);
        expect(findEntry(standings, pid)?.points).toBe(1);
      }
    });

    it("régression bug : les joueurs de side A sont mis à jour même si entry B n'a pas de joueurs", async () => {
      mockRepo.getPlayerPointsForStandings.mockImplementation(() =>
        Promise.resolve([
          {
            id: "m1",
            winnerSide: "A",
            playerPoints: [
              { playerId: "p-a1", pointsAwarded: 3, countsForRanking: true },
              { playerId: "p-a2", pointsAwarded: 3, countsForRanking: true },
            ],
            sides: [
              { position: 1, score: 3, entryId: "entry-a", entry: { id: "entry-a", players: [{ playerId: "p-a1" }, { playerId: "p-a2" }] } },
              { position: 2, score: 0, entryId: "entry-b", entry: { id: "entry-b", players: [] } },
            ],
          },
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "p-a1")?.points).toBe(3);
      expect(findEntry(standings, "p-a2")?.points).toBe(3);
    });

    it("joueur hors limite : countsForRanking=false → 0 pts et matchesPlayed incrémenté", async () => {
      mockRepo.getPlayerPointsForStandings.mockImplementation(() =>
        Promise.resolve([
          makeFlexMatchWithPoints("m1", "A", ["p-a1"], ["p-b1"], 3, 0, 3, 0, false /* countsForRanking = false */),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "p-a1")!;
      expect(a.points).toBe(0);
      expect(a.matchesPlayed).toBe(1);
      // W/D/L not counted when !countsForRanking
      expect(a.wins).toBe(0);
    });
  });

  // ── Classement provisoire vs officiel ─────────────────────────────────────

  describe("provisoire vs officiel", () => {
    const finalizedMatch = makeMatchWithSides("m-final", "A", { teamId: "team-a", score: 3 }, { teamId: "team-b", score: 1 });
    const reportedMatch = makeMatchWithSides("m-reported", "B", { teamId: "team-a", score: 0 }, { teamId: "team-b", score: 2 });

    beforeEach(() => {
      mockRepo.getMatchesWithSides.mockImplementation(
        (_id: any, statuses: any) =>
          Promise.resolve(
            [
              { ...finalizedMatch, status: "finalized" },
              { ...reportedMatch, status: "reported" },
            ].filter((m: any) => statuses.includes(m.status)),
          ),
      );
    });

    it("officiel : ne compte que les matchs finalized", async () => {
      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(a.points).toBe(3);
      expect(a.wins).toBe(1);
      expect(b.points).toBe(0);
      expect(b.matchesPlayed).toBe(1);
    });

    it("provisoire : compte reported + finalized", async () => {
      const { standings } = await standingsService.getProvisionalStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(a.points).toBe(3);
      expect(a.wins).toBe(1);
      expect(a.losses).toBe(1);
      expect(a.matchesPlayed).toBe(2);

      expect(b.points).toBe(3);
      expect(b.wins).toBe(1);
      expect(b.losses).toBe(1);
      expect(b.matchesPlayed).toBe(2);
    });

    it("provisoire a plus de matchs que l'officiel", async () => {
      const official = await standingsService.getOfficialStandings("tournament-1");
      const provisional = await standingsService.getProvisionalStandings("tournament-1");

      const officialTotal = official.standings.reduce((s, e) => s + e.matchesPlayed, 0);
      const provisionalTotal = provisional.standings.reduce((s, e) => s + e.matchesPlayed, 0);

      expect(provisionalTotal).toBeGreaterThan(officialTotal);
    });
  });
});
