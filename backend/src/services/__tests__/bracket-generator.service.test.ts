import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";

// Mock BracketsStorage to avoid DB connection
mock.module("../brackets-storage", () => ({
    BracketsStorage: class {
        insert = mock(async () => 1);
        select = mock(async () => []);
        update = mock(async () => true);
        delete = mock(async () => true);
    }
}));

// Mock BracketsManager
const createStageMock = mock(async (stage: any) => {});
const getTournamentDataMock = mock(async (id: string) => ({ 
    stage: [], 
    match: [], 
    match_game: [], 
    participant: [], 
    group: [], 
    round: [] 
}));

mock.module("brackets-manager", () => {
    return {
        BracketsManager: class {
            create = {
                stage: createStageMock
            };
            get = {
                tournamentData: getTournamentDataMock
            };
        }
    };
});

// Import service AFTER mocking
const { bracketGeneratorService } = await import("../bracket-generator.service");

describe("BracketGeneratorService", () => {
    const tournamentId = "t-1";

    afterEach(() => {
        createStageMock.mockClear();
        getTournamentDataMock.mockClear();
    });

    describe("generateBracket", () => {
        it("should call manager.create.stage with correct parameters for single elimination", async () => {
            const participants = [
                { teamId: "t1", seed: 1, name: "Team 1" },
                { teamId: "t2", seed: 2, name: "Team 2" },
            ];

            await bracketGeneratorService.generateBracket(tournamentId, participants, "single");

            expect(createStageMock).toHaveBeenCalled();
            // Cast to any to access the arguments of the first call safely in test context
            const callArg = createStageMock.mock.calls[0][0] as any;
            
            expect(callArg.tournamentId).toBe(tournamentId);
            expect(callArg.type).toBe("single_elimination");
            expect(callArg.seeding).toHaveLength(2);
            expect(callArg.seeding[0]).toEqual({ id: "t1", name: "Team 1", seed: 1 });
        });

        it("should call manager.create.stage with correct parameters for double elimination", async () => {
            const participants = [
                { teamId: "t1", seed: 1, name: "Team 1" },
                { teamId: "t2", seed: 2, name: "Team 2" },
            ];

            await bracketGeneratorService.generateBracket(tournamentId, participants, "double");

            expect(createStageMock).toHaveBeenCalled();
            const callArg = createStageMock.mock.calls[0][0] as any;
            
            expect(callArg.tournamentId).toBe(tournamentId);
            expect(callArg.type).toBe("double_elimination");
            expect(callArg.settings.grandFinal).toBe("simple");
        });
    });

    describe("getBracketData", () => {
        it("should return tournament data from manager", async () => {
            const data = await bracketGeneratorService.getBracketData(tournamentId);
            expect(getTournamentDataMock).toHaveBeenCalledWith(tournamentId);
            expect(data).toHaveProperty("match");
            expect(data).toHaveProperty("stage");
        });
    });
});
