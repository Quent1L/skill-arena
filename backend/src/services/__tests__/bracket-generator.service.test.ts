import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock bracket repository so tests remain pure unit tests
const saveBracketMatches = mock(async (matches: any[]) => {
    matches.forEach((match, index) => {
        // mimic repository behavior (assign ids)
        match.id = `match-${index + 1}`;
    });
});

mock.module("../../repository/bracket.repository", () => ({
    bracketRepository: {
        saveBracketMatches,
    },
}));

const { BracketGeneratorService } = await import("../bracket-generator.service");

describe("BracketGeneratorService", () => {
    const service = new BracketGeneratorService();
    const tournamentId = "t-1";

    describe("Single Elimination", () => {
        it("should generate correct bracket for 4 participants", async () => {
            const participants = [
                { teamId: "t1", seed: 1 },
                { teamId: "t2", seed: 2 },
                { teamId: "t3", seed: 3 },
                { teamId: "t4", seed: 4 },
            ];

            const matches = await service.generateBracket(tournamentId, participants, "single");

            // 4 participants -> 3 matches (2 semis, 1 final)
            expect(matches.length).toBe(3);

            // Round 1 (Semis)
            const round1 = matches.filter(m => m.round === 1);
            expect(round1.length).toBe(2);

            // Check seeding: 1 vs 4, 2 vs 3
            // Note: Order in array might vary, but pairs should be correct
            const match1vs4 = round1.find(m =>
                (m.teamAId === "t1" && m.teamBId === "t4") ||
                (m.teamAId === "t4" && m.teamBId === "t1")
            );
            expect(match1vs4).toBeDefined();

            const match2vs3 = round1.find(m =>
                (m.teamAId === "t2" && m.teamBId === "t3") ||
                (m.teamAId === "t3" && m.teamBId === "t2")
            );
            expect(match2vs3).toBeDefined();

            // Round 2 (Final)
            const round2 = matches.filter(m => m.round === 2);
            expect(round2.length).toBe(1);
        });

        it("should handle byes for 3 participants", async () => {
            const participants = [
                { teamId: "t1", seed: 1 },
                { teamId: "t2", seed: 2 },
                { teamId: "t3", seed: 3 },
            ];

            const matches = await service.generateBracket(tournamentId, participants, "single");

            // 3 participants -> 4 slots -> 3 matches (2 semis, 1 final)
            // But one semi has a bye
            expect(matches.length).toBe(3);

            const round1 = matches.filter(m => m.round === 1);

            // Seed 1 vs Bye (Seed 4)
            const match1 = round1.find(m => m.teamAId === "t1" || m.teamBId === "t1");
            expect(match1).toBeDefined();
            expect(match1?.teamAId === "t1" && !match1?.teamBId || !match1?.teamAId && match1?.teamBId === "t1").toBe(true);

            // Seed 2 vs Seed 3
            const match2vs3 = round1.find(m =>
                (m.teamAId === "t2" && m.teamBId === "t3") ||
                (m.teamAId === "t3" && m.teamBId === "t2")
            );
            expect(match2vs3).toBeDefined();
        });
    });

    describe("Double Elimination", () => {
        it("should generate correct bracket for 4 participants", async () => {
            const participants = [
                { teamId: "t1", seed: 1 },
                { teamId: "t2", seed: 2 },
                { teamId: "t3", seed: 3 },
                { teamId: "t4", seed: 4 },
            ];

            const matches = await service.generateBracket(tournamentId, participants, "double");

            // WB: 3 matches
            // LB: 
            // R1 (Lower): 2 matches (losers of WB semis) -> Wait, 4 participants.
            // WB R1 (Semis): 2 matches. Losers go to LB R1.
            // WB R2 (Final): 1 match. Loser goes to LB R2.
            // LB R1: 1 match (Loser WB Semi 1 vs Loser WB Semi 2).
            // LB R2: 1 match (Winner LB R1 vs Loser WB Final).
            // Grand Final: 1 match.
            // Total: 2 WB + 1 WB Final + 1 LB R1 + 1 LB R2 + 1 GF = 6 matches?

            // Let's count:
            // WB: 3 matches (same as single elim)
            // LB: 
            // 4 participants -> 2 rounds in WB.
            // LB Rounds = 2*2 - 2 = 2 rounds.
            // LB R1: 1 match.
            // LB R2: 1 match.
            // GF: 1 match.
            // Total = 3 + 2 + 1 = 6 matches.

            expect(matches.length).toBe(6);

            const wbMatches = matches.filter(m => m.bracketType === "winner");
            expect(wbMatches.length).toBe(3);

            const lbMatches = matches.filter(m => m.bracketType === "loser");
            expect(lbMatches.length).toBe(2);

            const gfMatches = matches.filter(m => m.bracketType === "grand_final");
            expect(gfMatches.length).toBe(1);
        });
    });
});
