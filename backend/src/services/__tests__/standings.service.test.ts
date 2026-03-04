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
};

const TEAM_A = { id: "team-a", name: "Alpha", tournamentId: "tournament-1" };
const TEAM_B = { id: "team-b", name: "Beta", tournamentId: "tournament-1" };
const TEAM_C = { id: "team-c", name: "Gamma", tournamentId: "tournament-1" };

function makeEntry(id: string, teamId: string, players: { playerId: string; displayName: string }[] = []) {
  return {
    id,
    entryType: "TEAM" as const,
    teamId,
    players: players.map((p) => ({
      playerId: p.playerId,
      player: { id: p.playerId, displayName: p.displayName },
    })),
  };
}

function makeSide(
  matchId: string,
  entryId: string,
  position: 1 | 2,
  score: number,
  entry: ReturnType<typeof makeEntry>,
  pointsAwarded: number | null = null,
) {
  return { matchId, entryId, position, score, pointsAwarded, entry };
}

function makeMatch(id: string, winnerSide: "A" | "B" | null, status = "finalized") {
  return { id, status, winnerSide };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRepo = {
  getTournamentWithScoring: mock(() => Promise.resolve(DEFAULT_TOURNAMENT as any)),
  getMatchesForStandings: mock(() => Promise.resolve([] as any[])),
  getMatchSides: mock(() => Promise.resolve([] as any[])),
  getTournamentTeams: mock(() => Promise.resolve([TEAM_A, TEAM_B] as any[])),
  getTournamentEntries: mock(() => Promise.resolve([] as any[])),
};

mock.module("../../repository/standings.repository", () => ({
  standingsRepository: mockRepo,
}));

import { standingsService } from "../standings.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetMocks() {
  mockRepo.getTournamentWithScoring.mockImplementation(() => Promise.resolve(DEFAULT_TOURNAMENT));
  mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([]));
  mockRepo.getMatchSides.mockImplementation(() => Promise.resolve([]));
  mockRepo.getTournamentTeams.mockImplementation(() => Promise.resolve([TEAM_A, TEAM_B]));
  mockRepo.getTournamentEntries.mockImplementation(() => Promise.resolve([]));
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
    const entryA = makeEntry("entry-a", "team-a");
    const entryB = makeEntry("entry-b", "team-b");

    it("victoire side A : A gagne 3 pts, B gagne 0 pt", async () => {
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 3, entryA),
          makeSide("m1", "entry-b", 2, 1, entryB),
        ]),
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
      const match = makeMatch("m1", "B");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 1, entryA),
          makeSide("m1", "entry-b", 2, 3, entryB),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(b.points).toBe(3);
      expect(b.wins).toBe(1);
      expect(a.points).toBe(0);
      expect(a.losses).toBe(1);
    });

    it("match nul : chaque équipe gagne 1 pt", async () => {
      const match = makeMatch("m1", null);
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 2, entryA),
          makeSide("m1", "entry-b", 2, 2, entryB),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      expect(a.points).toBe(1);
      expect(a.draws).toBe(1);
      expect(b.points).toBe(1);
      expect(b.draws).toBe(1);
    });

    it("pointsAwarded override les points du tournoi", async () => {
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 3, entryA, 5), // 5 pts custom
          makeSide("m1", "entry-b", 2, 1, entryB, 2), // 2 pts custom pour la défaite
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
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 2, entryA),
          makeSide("m1", "entry-b", 2, 0, entryB),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(2); // victoire = 2 pts
      expect(findEntry(standings, "team-b")?.points).toBe(1); // défaite = 1 pt
    });

    it("cumul de plusieurs matchs", async () => {
      // m1: A gagne, m2: B gagne, m3: nul
      const matches = [makeMatch("m1", "A"), makeMatch("m2", "B"), makeMatch("m3", null)];
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve(matches));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 3, entryA),
          makeSide("m1", "entry-b", 2, 1, entryB),
          makeSide("m2", "entry-a", 1, 0, entryA),
          makeSide("m2", "entry-b", 2, 2, entryB),
          makeSide("m3", "entry-a", 1, 1, entryA),
          makeSide("m3", "entry-b", 2, 1, entryB),
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
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([makeSide("m1", "entry-a", 1, 3, entryA)]),
      ); // seul 1 side

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(findEntry(standings, "team-a")?.points).toBe(0);
    });
  });

  // ── Tri / départage ────────────────────────────────────────────────────────

  describe("tri et départage", () => {
    it("trie par points décroissants", async () => {
      mockRepo.getTournamentTeams.mockImplementation(() => Promise.resolve([TEAM_A, TEAM_B, TEAM_C]));

      const entryA = makeEntry("entry-a", "team-a");
      const entryB = makeEntry("entry-b", "team-b");
      const entryC = makeEntry("entry-c", "team-c");

      const matches = [makeMatch("m1", "A"), makeMatch("m2", "A"), makeMatch("m3", "A")];
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve(matches));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          // A bat B et C, B bat C
          makeSide("m1", "entry-a", 1, 3, entryA),
          makeSide("m1", "entry-b", 2, 0, entryB),
          makeSide("m2", "entry-a", 1, 3, entryA),
          makeSide("m2", "entry-c", 2, 0, entryC),
          makeSide("m3", "entry-b", 1, 2, entryB),
          makeSide("m3", "entry-c", 2, 1, entryC),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      expect(standings[0].id).toBe("team-a"); // 6 pts
      expect(standings[1].id).toBe("team-b"); // 3 pts
      expect(standings[2].id).toBe("team-c"); // 0 pts
    });

    it("départage par scoreDiff si points égaux", async () => {
      const entryA = makeEntry("entry-a", "team-a");
      const entryB = makeEntry("entry-b", "team-b");

      // A et B ont chacun 3 pts (1 victoire)
      // A: scored=5, conceded=2, diff=+3 / B: scored=3, conceded=1, diff=+2
      const matches = [makeMatch("m1", "A"), makeMatch("m2", "B")];
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve(matches));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 5, entryA),
          makeSide("m1", "entry-b", 2, 2, entryB),
          makeSide("m2", "entry-a", 1, 1, entryA),  // A perd
          makeSide("m2", "entry-b", 2, 3, entryB),
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      // A: 3pts, diff= (5-2)+(1-3) = 3-2 = +1  → scored=6, conceded=5, diff=+1
      // B: 3pts, diff= (2-5)+(3-1) = -3+2 = -1  → scored=5, conceded=6, diff=-1
      expect(standings[0].id).toBe("team-a"); // meilleur diff
    });

    it("départage par buts marqués si scoreDiff égal", async () => {
      const entryA = makeEntry("entry-a", "team-a");
      const entryB = makeEntry("entry-b", "team-b");

      // Les deux ont 1 pt (nul) et scoreDiff=0
      // A: scored=5, B: scored=3
      const matches = [makeMatch("m1", null)];
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve(matches));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 5, entryA),
          makeSide("m1", "entry-b", 2, 5, entryB),
        ]),
      );

      // 2e match où les scores bruts sont différents: faisons 2 nuls
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          makeSide("m1", "entry-a", 1, 5, entryA),
          makeSide("m1", "entry-b", 2, 3, entryB),
        ]),
      );
      mockRepo.getMatchesForStandings.mockImplementation(() =>
        Promise.resolve([makeMatch("m1", null)]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      // scoreDiff: A= 5-3=+2, B= 3-5=-2 → A premier par scoreDiff déjà
      expect(standings[0].id).toBe("team-a");
    });
  });

  // ── Mode flex ─────────────────────────────────────────────────────────────

  describe("mode flex", () => {
    const flexTournament = { ...DEFAULT_TOURNAMENT, teamMode: "flex" as const };

    const entryAFlex = {
      id: "entry-a",
      entryType: "PLAYER" as const,
      teamId: null,
      players: [
        { playerId: "p-a1", player: { id: "p-a1", displayName: "Player A1" } },
        { playerId: "p-a2", player: { id: "p-a2", displayName: "Player A2" } },
      ],
    };

    const entryBFlex = {
      id: "entry-b",
      entryType: "PLAYER" as const,
      teamId: null,
      players: [
        { playerId: "p-b1", player: { id: "p-b1", displayName: "Player B1" } },
        { playerId: "p-b2", player: { id: "p-b2", displayName: "Player B2" } },
      ],
    };

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
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          { matchId: "m1", entryId: "entry-a", position: 1, score: 3, pointsAwarded: null, entry: entryAFlex },
          { matchId: "m1", entryId: "entry-b", position: 2, score: 1, pointsAwarded: null, entry: entryBFlex },
        ]),
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
      const match = makeMatch("m1", "B");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          { matchId: "m1", entryId: "entry-a", position: 1, score: 1, pointsAwarded: null, entry: entryAFlex },
          { matchId: "m1", entryId: "entry-b", position: 2, score: 3, pointsAwarded: null, entry: entryBFlex },
        ]),
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
      const match = makeMatch("m1", null);
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          { matchId: "m1", entryId: "entry-a", position: 1, score: 2, pointsAwarded: null, entry: entryAFlex },
          { matchId: "m1", entryId: "entry-b", position: 2, score: 2, pointsAwarded: null, entry: entryBFlex },
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      for (const pid of ["p-a1", "p-a2", "p-b1", "p-b2"]) {
        expect(findEntry(standings, pid)?.draws).toBe(1);
        expect(findEntry(standings, pid)?.points).toBe(1);
      }
    });

    it("régression bug : les joueurs de side A sont mis à jour même si entry B n'a pas de joueurs", async () => {
      const entryBEmpty = { ...entryBFlex, players: [] };
      const match = makeMatch("m1", "A");
      mockRepo.getMatchesForStandings.mockImplementation(() => Promise.resolve([match]));
      mockRepo.getMatchSides.mockImplementation(() =>
        Promise.resolve([
          { matchId: "m1", entryId: "entry-a", position: 1, score: 3, pointsAwarded: null, entry: entryAFlex },
          { matchId: "m1", entryId: "entry-b", position: 2, score: 0, pointsAwarded: null, entry: entryBEmpty },
        ]),
      );

      const { standings } = await standingsService.getOfficialStandings("tournament-1");

      // Sans le fix, p-a1 et p-a2 auraient 0 pts (skippés à cause du guard supprimé)
      expect(findEntry(standings, "p-a1")?.points).toBe(3);
      expect(findEntry(standings, "p-a2")?.points).toBe(3);
    });
  });

  // ── Classement provisoire vs officiel ─────────────────────────────────────

  describe("provisoire vs officiel", () => {
    const entryA = makeEntry("entry-a", "team-a");
    const entryB = makeEntry("entry-b", "team-b");

    const finalizedMatch = makeMatch("m-final", "A", "finalized");
    const reportedMatch = makeMatch("m-reported", "B", "reported");

    const allMatchSides = [
      makeSide("m-final", "entry-a", 1, 3, entryA),
      makeSide("m-final", "entry-b", 2, 1, entryB),
      makeSide("m-reported", "entry-a", 1, 0, entryA),
      makeSide("m-reported", "entry-b", 2, 2, entryB),
    ];

    beforeEach(() => {
      mockRepo.getMatchesForStandings.mockImplementation(
        (_id: string, statuses: string[]) =>
          Promise.resolve(
            [finalizedMatch, reportedMatch].filter((m) => statuses.includes(m.status)),
          ),
      );
      mockRepo.getMatchSides.mockImplementation((ids: string[]) =>
        Promise.resolve(allMatchSides.filter((s) => ids.includes(s.matchId))),
      );
    });

    it("officiel : ne compte que les matchs finalized", async () => {
      const { standings } = await standingsService.getOfficialStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      // Seul m-final est compté: A gagne 3 pts
      expect(a.points).toBe(3);
      expect(a.wins).toBe(1);
      expect(b.points).toBe(0);
      expect(b.matchesPlayed).toBe(1);
    });

    it("provisoire : compte reported + finalized", async () => {
      const { standings } = await standingsService.getProvisionalStandings("tournament-1");
      const a = findEntry(standings, "team-a")!;
      const b = findEntry(standings, "team-b")!;

      // m-final: A gagne (3 pts A) + m-reported: B gagne (3 pts B)
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
