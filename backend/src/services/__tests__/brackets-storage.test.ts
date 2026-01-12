import { describe, it, expect, beforeEach, vi } from "bun:test";
import { BracketsStorage } from "../brackets-storage";
import { matchParticipantRepository, ParticipantRole } from "../../repository/match-participant.repository";
import { db } from "../../config/database";
import { matches } from "../../db/schema";
import { eq } from "drizzle-orm";

vi.mock("../../config/database", () => ({
    db: {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        query: {
            matches: {
                findFirst: vi.fn()
            },
            teams: {
                findFirst: vi.fn()
            }
        }
    }
}));

vi.mock("../../repository/match-participant.repository", () => ({
    matchParticipantRepository: {
        create: vi.fn(),
        getByMatchId: vi.fn(),
        deleteByMatchId: vi.fn()
    },
    ParticipantRole: {
        SEED_1: 'SEED_1',
        SEED_2: 'SEED_2',
        HOME: 'HOME',
        AWAY: 'AWAY'
    }
}));

describe("BracketsStorage", () => {
    let storage: BracketsStorage;

    beforeEach(() => {
        vi.clearAllMocks();
        storage = new BracketsStorage();
    });

    describe("insert", () => {
        it("should insert match and create participants", async () => {
            const matchData = {
                id: 1, // Brackets manager uses numbers sometimes, mapped to generic
                stage_id: 1,
                group_id: 1,
                round_id: 1,
                child_count: 0,
                status: 0, // Scheduled
                number: 1,
                opponent1: { id: "team1", score: 10, result: "win" as const },
                opponent2: { id: "team2", score: 5, result: "loss" as const }
            };

            // Mock stage fetching
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{ id: 1, tournamentId: "t1" }])
                })
            });

            // Mock match insert
            (db.insert as any).mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: "match-uuid" }])
                })
            });

            await storage.insert("match", matchData);

            // Check match insert
            expect(db.insert).toHaveBeenCalled();
            // Check participant creation
            expect(matchParticipantRepository.create).toHaveBeenCalledTimes(2);
            expect(matchParticipantRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                matchId: "match-uuid",
                teamId: "team1",
                role: ParticipantRole.SEED_1
            }));
        });
    });

    describe("select", () => {
        it("should select match and map participants to opponents", async () => {
            // Mock db select
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([{
                        id: "match-uuid",
                        bracket_status: 1
                    }])
                })
            });

            // Mock participants fetch
            (matchParticipantRepository.getByMatchId as any).mockResolvedValue([
                { id: "p1", position: 1, teamId: "team1", score: 10, isWinner: true },
                { id: "p2", position: 2, teamId: "team2", score: 5, isWinner: false }
            ]);

            const result = await storage.select("match", 1);

            expect(result).toBeDefined();
            if (result && !Array.isArray(result)) {
                expect(result.opponent1).toEqual({ id: "team1", position: 1, score: 10, result: "win" });
                expect(result.opponent2).toEqual({ id: "team2", position: 2, score: 5, result: "loss" });
            }
        });
    });

    describe("update", () => {
        it("should update match and sync participants", async () => {
            const updateData = {
                id: 1,
                opponent1: { id: "team1", score: 10 },
                opponent2: { id: "team2", score: 8 }
            };

            // Mock update returning match UUID
            const updateMock = {
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: "match-uuid" }])
                    })
                })
            };
            (db.update as any).mockReturnValue(updateMock);

            await storage.update("match", { id: 1 }, updateData);

            expect(matchParticipantRepository.deleteByMatchId).toHaveBeenCalledWith("match-uuid");
            expect(matchParticipantRepository.create).toHaveBeenCalledTimes(2);
        });
    });
});
