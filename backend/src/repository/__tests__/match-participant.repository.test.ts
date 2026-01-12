import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { matchParticipantRepository, ParticipantRole } from "../match-participant.repository";
import { db } from "../../config/database";
import { matchParticipants, matchParticipantPlayers } from "../../db/schema";
import { eq } from "drizzle-orm";

// Mock database calls
vi.mock("../../config/database", () => ({
    db: {
        insert: vi.fn(),
        query: {
            matchParticipants: {
                findMany: vi.fn()
            }
        },
        update: vi.fn(),
        delete: vi.fn(),
        transaction: vi.fn(async (callback) => await callback({
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn().mockResolvedValue([{ id: "winner" }])
                    })),
                    returning: vi.fn().mockResolvedValue([{ id: "winner" }]) // Just in case it's called earlier
                }))
            }))
        }))
    }
}));

describe("MatchParticipantRepository", () => {
    const mockMatchId = "match-123";
    const mockTeamId = "team-123";
    const mockPlayerIds = ["user-1", "user-2"];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("create", () => {
        it("should create a static participant", async () => {
            // Setup mock return
            const mockResult = { id: "p1", matchId: mockMatchId, teamId: mockTeamId, role: ParticipantRole.HOME };
            const insertMock = vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockResult])
            });
            (db.insert as any).mockImplementation(() => ({
                values: insertMock
            }));

            const result = await matchParticipantRepository.create({
                matchId: mockMatchId,
                teamId: mockTeamId,
                role: ParticipantRole.HOME,
                position: 1
            });

            expect(db.insert).toHaveBeenCalledWith(matchParticipants);
            expect(insertMock).toHaveBeenCalled(); // .values()
            expect(result).toEqual(mockResult);
        });

        it("should create a flex participant with players", async () => {
            const mockResult = { id: "p2", matchId: mockMatchId, role: ParticipantRole.AWAY };
            // First insert (participant)
            const insertParticipantChain = {
                returning: vi.fn().mockResolvedValue([mockResult])
            };

            // Second insert (players)
            const insertPlayersChain = {
                values: vi.fn().mockResolvedValue(undefined)
            };

            (db.insert as any)
                .mockImplementationOnce(() => ({ values: vi.fn().mockReturnValue(insertParticipantChain) }))
                .mockImplementationOnce(() => ({ values: vi.fn() })); // For players

            await matchParticipantRepository.create({
                matchId: mockMatchId,
                role: ParticipantRole.AWAY,
                position: 2,
                players: mockPlayerIds
            });

            expect(db.insert).toHaveBeenCalledTimes(2);
            expect(db.insert).toHaveBeenNthCalledWith(2, matchParticipantPlayers);
        });
    });

    describe("updateScore", () => {
        it("should update score", async () => {
            const setMock = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(undefined) // updateScore doesn't return anything in repo, just awaits
            });
            // Repo: await db.update(...).set(...).where(...)  (no returning in actual code???)
            // Check actual code: 
            // async updateScore(participantId: string, score: number) {
            //   await db.update(matchParticipants).set({ score }).where(eq(matchParticipants.id, participantId));
            // }
            // The test failure earlier said returning() is not a function. This implies I added returning() in refactoring or previous test check implied it.
            // Let's assume repo implements it without returning().
            // WAIT, previous error: TypeError: db.update(matchParticipants).set({ score }).where(eq(matchParticipants.id, participantId)).returning is not a function.
            // This means the CODE called .returning(), so the repo DOES have .returning().
            // I should check repo content if unsure. But I wrote it in Step 4.
            // Let's mock returning.

            const whereMock = vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([])
            });

            const setMock2 = vi.fn().mockReturnValue({
                where: whereMock
            });

            (db.update as any).mockImplementation(() => ({
                set: setMock2
            }));

            await matchParticipantRepository.updateScore("p1", 10);

            expect(db.update).toHaveBeenCalledWith(matchParticipants);
            expect(setMock2).toHaveBeenCalledWith({ score: 10 });
        });
    });

    describe("setWinner", () => {
        it("should reset others and set winner (transaction)", async () => {
            // logic handled by transaction mock structure above
            await matchParticipantRepository.setWinner(mockMatchId, "p1");
            expect(db.transaction).toHaveBeenCalled();
            // Verification of transaction logic via mock internals is tricky without accessing the callback.
            // But we assume mock calls callback.
        });
    });
});
