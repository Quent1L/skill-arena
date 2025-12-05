import { BadRequestError, ErrorCode } from "../types/errors";
import type { BracketMatch, BracketParticipant } from "../types/bracket";
import { bracketRepository } from "../repository/bracket.repository";

/**
 * Single Elimination Bracket Generator
 */
export class SingleEliminationGenerator {
    private tournamentId: string;
    private participants: BracketParticipant[];
    private bracketMatches: BracketMatch[] = [];
    private sequenceCounter = 0;

    constructor(tournamentId: string, participants: BracketParticipant[]) {
        this.tournamentId = tournamentId;
        this.participants = this.seedParticipants(participants);
    }

    /**
     * Seed participants (currently just assigns sequential seeds if not provided)
     */
    private seedParticipants(
        participants: BracketParticipant[]
    ): BracketParticipant[] {
        return participants.map((p, index) => ({
            ...p,
            seed: p.seed ?? index + 1,
        }));
    }

    /**
     * Calculate number of rounds needed
     */
    private calculateRounds(numParticipants: number): number {
        return Math.ceil(Math.log2(numParticipants));
    }

    /**
     * Calculate number of matches in first round (handles byes)
     */
    private calculateFirstRoundMatches(numParticipants: number): number {
        const nextPowerOf2 = Math.pow(2, this.calculateRounds(numParticipants));
        return numParticipants - (nextPowerOf2 - numParticipants);
    }

    /**
     * Generate the complete single elimination bracket
     */
    public generate(): BracketMatch[] {
        const numParticipants = this.participants.length;

        if (numParticipants < 2) {
            throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
        }

        const totalRounds = this.calculateRounds(numParticipants);

        // Generate matches for each round, starting from the final and working backwards
        const matchesByRound: BracketMatch[][] = [];

        for (let round = totalRounds; round >= 1; round--) {
            const matchesInRound = Math.pow(2, totalRounds - round);
            const roundMatches: BracketMatch[] = [];

            for (let i = 0; i < matchesInRound; i++) {
                const match: BracketMatch = {
                    tournamentId: this.tournamentId,
                    round,
                    sequence: this.sequenceCounter++,
                    bracketType: "winner",
                    matchPosition: this.calculateMatchPosition(round, i, totalRounds),
                };

                roundMatches.push(match);
            }

            matchesByRound.unshift(roundMatches);
        }

        // Link matches (winner of match i goes to match i/2 in next round)
        for (let roundIdx = 0; roundIdx < matchesByRound.length - 1; roundIdx++) {
            const currentRound = matchesByRound[roundIdx];
            const nextRound = matchesByRound[roundIdx + 1];

            for (let i = 0; i < currentRound.length; i++) {
                const nextMatchIdx = Math.floor(i / 2);
                currentRound[i].nextMatchWinId = `TEMP_${nextRound[nextMatchIdx].sequence}`;
            }
        }

        // Flatten all matches
        this.bracketMatches = matchesByRound.flat();

        // Assign participants to first round
        this.assignParticipantsToFirstRound();

        return this.bracketMatches;
    }

    /**
     * Calculate visual position for match in bracket
     */
    private calculateMatchPosition(
        round: number,
        matchIndex: number,
        totalRounds: number
    ): number {
        // Position calculation for visual rendering
        // Matches in later rounds are more spread out
        const spacing = Math.pow(2, totalRounds - round);
        return matchIndex * spacing;
    }

    /**
     * Assign participants to first round matches
     */
    private assignParticipantsToFirstRound(): void {
        const firstRoundMatches = this.bracketMatches.filter((m) => m.round === 1);
        const bracketSize = Math.pow(2, this.calculateRounds(this.participants.length));
        const seedingOrder = getSeedingOrder(bracketSize);

        // Assign participants based on seeding order
        for (let i = 0; i < firstRoundMatches.length; i++) {
            const match = firstRoundMatches[i];

            // Slot 1 (Team A)
            const seedA = seedingOrder[i * 2];
            if (seedA <= this.participants.length) {
                match.teamAId = this.participants[seedA - 1].teamId;
            }

            // Slot 2 (Team B)
            const seedB = seedingOrder[i * 2 + 1];
            if (seedB <= this.participants.length) {
                match.teamBId = this.participants[seedB - 1].teamId;
            }
        }
    }
}

/**
 * Double Elimination Bracket Generator
 */
export class DoubleEliminationGenerator {
    private tournamentId: string;
    private participants: BracketParticipant[];
    private bracketMatches: BracketMatch[] = [];
    private sequenceCounter = 0;
    private winnerBracketMatches: Map<string, BracketMatch> = new Map();
    private loserBracketMatches: Map<string, BracketMatch> = new Map();

    constructor(tournamentId: string, participants: BracketParticipant[]) {
        this.tournamentId = tournamentId;
        this.participants = this.seedParticipants(participants);
    }

    private seedParticipants(
        participants: BracketParticipant[]
    ): BracketParticipant[] {
        return participants.map((p, index) => ({
            ...p,
            seed: p.seed ?? index + 1,
        }));
    }

    /**
     * Generate complete double elimination bracket
     */
    public generate(): BracketMatch[] {
        const numParticipants = this.participants.length;

        if (numParticipants < 2) {
            throw new BadRequestError(ErrorCode.VALIDATION_ERROR);
        }

        // Generate Winner Bracket (same as single elimination)
        this.generateWinnerBracket();

        // Generate Loser Bracket
        this.generateLoserBracket();

        // Generate Grand Finals
        this.generateGrandFinals();

        return this.bracketMatches;
    }

    /**
     * Generate Winner Bracket (identical to single elimination)
     */
    private generateWinnerBracket(): void {
        const numParticipants = this.participants.length;
        const totalRounds = Math.ceil(Math.log2(numParticipants));

        const matchesByRound: BracketMatch[][] = [];

        for (let round = totalRounds; round >= 1; round--) {
            const matchesInRound = Math.pow(2, totalRounds - round);
            const roundMatches: BracketMatch[] = [];

            for (let i = 0; i < matchesInRound; i++) {
                const match: BracketMatch = {
                    tournamentId: this.tournamentId,
                    round,
                    sequence: this.sequenceCounter++,
                    bracketType: "winner",
                    matchPosition: i * Math.pow(2, totalRounds - round),
                };

                this.winnerBracketMatches.set(`WB_R${round}_M${i}`, match);
                roundMatches.push(match);
            }

            matchesByRound.unshift(roundMatches);
        }

        // Link winner bracket matches
        for (let roundIdx = 0; roundIdx < matchesByRound.length - 1; roundIdx++) {
            const currentRound = matchesByRound[roundIdx];
            const nextRound = matchesByRound[roundIdx + 1];

            for (let i = 0; i < currentRound.length; i++) {
                const nextMatchIdx = Math.floor(i / 2);
                const currentKey = `WB_R${currentRound[i].round}_M${i}`;
                const nextKey = `WB_R${nextRound[nextMatchIdx].round}_M${nextMatchIdx}`;

                currentRound[i].nextMatchWinId = `TEMP_${this.winnerBracketMatches.get(nextKey)!.sequence}`;
            }
        }

        this.bracketMatches.push(...matchesByRound.flat());

        // Assign participants to first round
        this.assignParticipantsToWinnerBracket(matchesByRound[0]);
    }

    /**
     * Assign participants to winner bracket first round
     */
    private assignParticipantsToWinnerBracket(firstRoundMatches: BracketMatch[]): void {
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(this.participants.length)));
        const seedingOrder = getSeedingOrder(bracketSize);

        // Assign participants based on seeding order
        for (let i = 0; i < firstRoundMatches.length; i++) {
            const match = firstRoundMatches[i];

            // Slot 1 (Team A)
            const seedA = seedingOrder[i * 2];
            if (seedA <= this.participants.length) {
                match.teamAId = this.participants[seedA - 1].teamId;
            }

            // Slot 2 (Team B)
            const seedB = seedingOrder[i * 2 + 1];
            if (seedB <= this.participants.length) {
                match.teamBId = this.participants[seedB - 1].teamId;
            }
        }
    }

    /**
     * Generate Loser Bracket
     */
    private generateLoserBracket(): void {
        const numParticipants = this.participants.length;
        const wbRounds = Math.ceil(Math.log2(numParticipants));

        // Loser bracket has (2 * wbRounds - 1) rounds
        // Alternates between "upper" rounds (receiving WB losers) and "lower" rounds (LB matches)
        const lbRounds = 2 * wbRounds - 2;

        let lbRound = 1;
        let matchesInRound = Math.pow(2, wbRounds - 2);

        for (let i = 0; i < lbRounds; i++) {
            const roundMatches: BracketMatch[] = [];
            const isUpperRound = i % 2 === 0;

            for (let j = 0; j < matchesInRound; j++) {
                const match: BracketMatch = {
                    tournamentId: this.tournamentId,
                    round: lbRound,
                    sequence: this.sequenceCounter++,
                    bracketType: "loser",
                    matchPosition: j * 100 + 1000, // Offset for visual separation
                };

                this.loserBracketMatches.set(`LB_R${lbRound}_M${j}`, match);
                roundMatches.push(match);
            }

            this.bracketMatches.push(...roundMatches);

            // After lower rounds, reduce number of matches
            if (!isUpperRound) {
                matchesInRound = Math.floor(matchesInRound / 2);
            }

            lbRound++;
        }

        // Link loser bracket matches and connect WB losers to LB
        this.linkLoserBracket(wbRounds, lbRounds);
    }

    /**
     * Link loser bracket matches and connect to winner bracket
     */
    private linkLoserBracket(wbRounds: number, lbRounds: number): void {
        // Connect WB losers to LB first round
        const wbFirstRound = Array.from(this.winnerBracketMatches.values()).filter(
            (m) => m.round === 1
        );

        wbFirstRound.forEach((wbMatch, idx) => {
            const lbMatchIdx = Math.floor(idx / 2);
            const lbMatch = this.loserBracketMatches.get(`LB_R1_M${lbMatchIdx}`);
            if (lbMatch) {
                wbMatch.nextMatchLoseId = `TEMP_${lbMatch.sequence}`;
            }
        });

        // Connect subsequent WB rounds to LB
        for (let wbRound = 2; wbRound <= wbRounds; wbRound++) {
            const wbMatches = Array.from(this.winnerBracketMatches.values()).filter(
                (m) => m.round === wbRound
            );

            wbMatches.forEach((wbMatch, idx) => {
                // Calculate corresponding LB round (upper round)
                const lbRound = (wbRound - 1) * 2;
                if (lbRound <= lbRounds) {
                    const lbMatch = this.loserBracketMatches.get(`LB_R${lbRound}_M${idx}`);
                    if (lbMatch) {
                        wbMatch.nextMatchLoseId = `TEMP_${lbMatch.sequence}`;
                    }
                }
            });
        }

        // Link LB matches to each other
        let currentLbRound = 1;
        while (currentLbRound < lbRounds) {
            const currentMatches = Array.from(
                this.loserBracketMatches.values()
            ).filter((m) => m.round === currentLbRound);

            currentMatches.forEach((match, idx) => {
                // If current round is lower round (odd), matches merge (2 -> 1)
                // If current round is upper round (even), matches map 1-to-1 to next round

                // Wait, standard LB structure:
                // R1 (Lower): WB losers drop here. Winners go to R2.
                // R2 (Upper): R1 winners vs WB losers. Winners go to R3.
                // R3 (Lower): R2 winners play each other. Winners go to R4.
                // R4 (Upper): R3 winners vs WB losers.

                // My round numbering:
                // i=0 (R1): Lower (matchesInRound = N/4)
                // i=1 (R2): Upper (matchesInRound = N/4)
                // i=2 (R3): Lower (matchesInRound = N/8)
                // i=3 (R4): Upper (matchesInRound = N/8)

                const isLowerRound = currentLbRound % 2 !== 0;

                if (isLowerRound) {
                    // Lower round -> Upper round (1-to-1 mapping, but filling slots)
                    // Actually, R1 winners go to R2. R2 has same number of matches.
                    // So Match i in R1 goes to Match i in R2.
                    const nextMatch = this.loserBracketMatches.get(
                        `LB_R${currentLbRound + 1}_M${idx}`
                    );
                    if (nextMatch) {
                        match.nextMatchWinId = `TEMP_${nextMatch.sequence}`;
                    }
                } else {
                    // Upper round -> Lower round (2-to-1 mapping)
                    // R2 winners go to R3. R3 has half matches.
                    const nextMatchIdx = Math.floor(idx / 2);
                    const nextMatch = this.loserBracketMatches.get(
                        `LB_R${currentLbRound + 1}_M${nextMatchIdx}`
                    );
                    if (nextMatch) {
                        match.nextMatchWinId = `TEMP_${nextMatch.sequence}`;
                    }
                }
            });

            currentLbRound++;
        }
    }

    /**
     * Generate Grand Finals matches
     */
    private generateGrandFinals(): void {
        // Grand Final 1
        const grandFinal: BracketMatch = {
            tournamentId: this.tournamentId,
            round: 999, // Special round number for grand final
            sequence: this.sequenceCounter++,
            bracketType: "grand_final",
            matchPosition: 9999,
        };

        // Connect WB winner and LB winner to Grand Final
        const wbFinalMatch = Array.from(this.winnerBracketMatches.values()).find(
            (m) => !m.nextMatchWinId
        );
        const lbFinalMatch = Array.from(this.loserBracketMatches.values()).find(
            (m) => !m.nextMatchWinId
        );

        if (wbFinalMatch) {
            wbFinalMatch.nextMatchWinId = `TEMP_${grandFinal.sequence}`;
        }
        if (lbFinalMatch) {
            lbFinalMatch.nextMatchWinId = `TEMP_${grandFinal.sequence}`;
        }

        this.bracketMatches.push(grandFinal);
    }
}

/**
 * Generate standard bracket seeding order
 * e.g. for 8 slots: [1, 8, 4, 5, 2, 7, 3, 6]
 */
function getSeedingOrder(size: number): number[] {
    if (size < 2) return [1];

    let seeds = [1, 2];
    let count = 2;

    while (count < size) {
        const nextSeeds: number[] = [];
        for (const seed of seeds) {
            nextSeeds.push(seed);
            nextSeeds.push(count * 2 + 1 - seed);
        }
        seeds = nextSeeds;
        count *= 2;
    }

    return seeds;
}


/**
 * Main Bracket Generator Service
 */
export class BracketGeneratorService {
    /**
     * Generate bracket for a tournament
     */
    async generateBracket(
        tournamentId: string,
        participants: BracketParticipant[],
        bracketType: "single" | "double"
    ): Promise<BracketMatch[]> {
        let generator: SingleEliminationGenerator | DoubleEliminationGenerator;

        if (bracketType === "single") {
            generator = new SingleEliminationGenerator(tournamentId, participants);
        } else {
            generator = new DoubleEliminationGenerator(tournamentId, participants);
        }

        const bracketMatches = generator.generate();

        // Save to database via repository (assigns real IDs back to matches)
        await bracketRepository.saveBracketMatches(bracketMatches);

        return bracketMatches;
    }
}

export const bracketGeneratorService = new BracketGeneratorService();
