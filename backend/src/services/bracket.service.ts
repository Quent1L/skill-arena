import { bracketRepository } from "../repository/bracket.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { entryRepository } from "../repository/entry.repository";
import { matchRepository } from "../repository/match.repository";
import { participantRepository } from "../repository/participant.repository";
import { standingsService } from "./standings.service";
import { tournamentService } from "./tournament.service";
import { db } from "../config/database";
import {
  matches,
  matchSides,
  tournamentEntries,
  tournamentEntryPlayers,
} from "../db/schema";
import { eq } from "drizzle-orm";
import type { GenerateBracketInput } from "@skill-arena/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../db/schema";
import {
  ErrorCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from "../types/errors";

interface BracketSeedData {
  entryId: string;
  seedNumber: number;
  seedingScore?: number;
}

interface RoundData {
  roundNumber: number;
  roundName: string;
  bracketType: "winners" | "losers" | "bronze";
  matchesCount: number;
  matches: MatchData[];
}

interface MatchData {
  matchNumber: number;
  entryAId?: string;
  entryBId?: string;
  isByeMatch: boolean;
  winnerToMatchNumber?: number;
  loserToMatchNumber?: number;
}

export class BracketService {
  // ============================================
  // Main API Methods
  // ============================================

  /**
   * Generate or regenerate a bracket for a tournament
   */
  async generateBracket(
    tournamentId: string,
    input: GenerateBracketInput,
    userId: string
  ) {
    return await db.transaction(async (tx) => {
      // 1. Validate generation is allowed
      await this.validateBracketGeneration(tournamentId, userId, input);

      // 2. Delete existing bracket if any
      const existingConfig = await bracketRepository.getConfigByTournamentId(
        tournamentId,
        tx
      );
      if (existingConfig) {
        await bracketRepository.deleteAllBracketData(tournamentId, tx);
      }

      // 3. Get or create tournament entries from participants
      const entries = await this.getOrCreateEntriesFromParticipants(
        tournamentId,
        tx
      );

      if (entries.length < 2) {
        throw new BadRequestError(ErrorCode.INSUFFICIENT_PARTICIPANTS, {
          min: 2,
          current: entries.length,
        });
      }

      // 4. Generate seeding
      const seeds = await this.generateSeeding(
        tournamentId,
        entries,
        input,
        tx
      );

      // 5. Create bracket config
      const config = await bracketRepository.createConfig(
        {
          tournamentId,
          bracketType: input.bracketType,
          seedingType: input.seedingType,
          sourceTournamentId: input.sourceTournamentId,
          totalParticipants: seeds.length,
          roundsCount: this.calculateRoundsCount(
            seeds.length,
            input.bracketType
          ),
          hasBronzeMatch: input.hasBronzeMatch || false,
        },
        tx
      );

      // 6. Save seeds
      await bracketRepository.createSeeds(
        seeds.map((s) => ({
          bracketConfigId: config.id,
          entryId: s.entryId,
          seedNumber: s.seedNumber,
          seedingScore: s.seedingScore,
        })),
        tx
      );

      // 7. Generate bracket structure
      const rounds = await this.generateBracketStructure(
        config.bracketType,
        seeds,
        config.hasBronzeMatch
      );

      // 8. Create rounds and matches
      await this.createRoundsAndMatches(
        config.id,
        tournamentId,
        rounds,
        tx
      );

      // 9. Return complete bracket data
      return await bracketRepository.getBracketDataByTournamentId(tournamentId);
    });
  }

  /**
   * Get bracket data for a tournament
   */
  async getBracketData(tournamentId: string) {
    return await bracketRepository.getBracketDataByTournamentId(tournamentId);
  }

  /**
   * Check if bracket can be generated/regenerated
   */
  async canGenerateBracket(tournamentId: string) {
    const tournament = await tournamentRepository.getById(tournamentId);

    if (!tournament) {
      return {
        canGenerate: false,
        reason: "Tournament not found",
      };
    }

    if (tournament.mode !== "bracket") {
      return {
        canGenerate: false,
        reason: "Tournament must be in bracket mode",
      };
    }

    if (!["open", "ongoing"].includes(tournament.status)) {
      return {
        canGenerate: false,
        reason: "Tournament must be open or ongoing",
      };
    }

    // Check if there are any finalized or confirmed matches
    const matches = await matchRepository.list({ tournamentId });
    const hasConfirmedMatches = matches.some((m) =>
      ["confirmed", "finalized"].includes(m.status)
    );

    if (hasConfirmedMatches) {
      return {
        canGenerate: false,
        reason: "Cannot regenerate: matches already finalized/confirmed",
        matchCount: matches.length,
      };
    }

    return {
      canGenerate: true,
      matchCount: matches.length,
    };
  }

  /**
   * Delete bracket and all associated matches
   */
  async deleteBracket(tournamentId: string, userId: string) {
    // Check permissions
    const canManage = await tournamentService.canManageTournament(
      tournamentId,
      userId
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    await bracketRepository.deleteAllBracketData(tournamentId);
  }

  // ============================================
  // Validation Methods
  // ============================================

  private async validateBracketGeneration(
    tournamentId: string,
    userId: string,
    input: GenerateBracketInput
  ) {
    // Check permissions
    const canManage = await tournamentService.canManageTournament(
      tournamentId,
      userId
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Get tournament
    const tournament = await tournamentRepository.getById(tournamentId);
    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    // Check mode
    if (tournament.mode !== "bracket") {
      throw new BadRequestError(ErrorCode.INVALID_TOURNAMENT_MODE, {
        expected: "bracket",
        actual: tournament.mode,
      });
    }

    // Check status
    if (!["open", "ongoing"].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS);
    }

    // Check for confirmed/finalized matches
    const canGenerate = await this.canGenerateBracket(tournamentId);
    if (!canGenerate.canGenerate) {
      throw new ConflictError(ErrorCode.BRACKET_CANNOT_REGENERATE, {
        reason: canGenerate.reason,
      });
    }

    // Validate championship seeding if specified
    if (input.seedingType === "championship_based") {
      await this.validateChampionshipSeeding(
        input.sourceTournamentId!,
        tournament.disciplineId ?? undefined
      );
    }
  }

  private async validateChampionshipSeeding(
    sourceTournamentId: string,
    targetDisciplineId?: string
  ) {
    const sourceTournament = await tournamentRepository.getById(
      sourceTournamentId
    );

    if (!sourceTournament) {
      throw new NotFoundError(ErrorCode.SOURCE_TOURNAMENT_NOT_FOUND);
    }

    // Must be finished
    if (sourceTournament.status !== "finished") {
      throw new BadRequestError(ErrorCode.SOURCE_TOURNAMENT_NOT_FINISHED);
    }

    // Must have same discipline
    if (
      targetDisciplineId &&
      sourceTournament.disciplineId !== targetDisciplineId
    ) {
      throw new BadRequestError(ErrorCode.DISCIPLINE_MISMATCH);
    }
  }

  // ============================================
  // Entry Management
  // ============================================

  /**
   * Get or create entries from tournament participants
   * This ensures that all active participants have an entry before bracket generation
   */
  private async getOrCreateEntriesFromParticipants(
    tournamentId: string,
    tx: NodePgDatabase<typeof schema> | typeof db
  ) {
    // Get all active participants
    const participants = await participantRepository.findTournamentParticipants(
      tournamentId
    );

    // Get existing entries using tx
    const existingEntries = await tx.query.tournamentEntries.findMany({
      where: eq(tournamentEntries.tournamentId, tournamentId),
      with: {
        team: true,
        players: {
          with: {
            player: true,
          },
        },
      },
    });

    // Create a map of existing entries by player ID for quick lookup
    const existingEntryPlayerIds = new Set<string>();
    for (const entry of existingEntries) {
      if (entry.players) {
        for (const player of entry.players) {
          existingEntryPlayerIds.add(player.playerId);
        }
      }
    }

    // Create entries for participants that don't have one yet
    for (const participant of participants) {
      if (!existingEntryPlayerIds.has(participant.userId)) {
        await entryRepository.create(
          {
            tournamentId,
            entryType: "PLAYER",
            playerIds: [participant.userId],
          },
          tx
        );
      }
    }

    // Return all entries (using tx to see newly created ones)
    return await tx.query.tournamentEntries.findMany({
      where: eq(tournamentEntries.tournamentId, tournamentId),
      with: {
        team: true,
        players: {
          with: {
            player: true,
          },
        },
      },
    });
  }

  // ============================================
  // Seeding Algorithms
  // ============================================

  private async generateSeeding(
    tournamentId: string,
    entries: Awaited<ReturnType<typeof entryRepository.getByTournament>>,
    input: GenerateBracketInput,
    tx: any
  ): Promise<BracketSeedData[]> {
    if (input.seedingType === "random") {
      return this.generateRandomSeeding(entries);
    } else {
      return await this.generateChampionshipSeeding(
        entries,
        input.sourceTournamentId!
      );
    }
  }

  private generateRandomSeeding(
    entries: Awaited<ReturnType<typeof entryRepository.getByTournament>>
  ): BracketSeedData[] {
    // Shuffle entries randomly
    const shuffled = [...entries].sort(() => Math.random() - 0.5);

    return shuffled.map((entry, index) => ({
      entryId: entry.id,
      seedNumber: index + 1,
    }));
  }

  private async generateChampionshipSeeding(
    entries: Awaited<ReturnType<typeof entryRepository.getByTournament>>,
    sourceTournamentId: string
  ): Promise<BracketSeedData[]> {
    // Get official standings from source tournament
    const { standings } = await standingsService.getOfficialStandings(
      sourceTournamentId
    );

    // Create map of entry ID to standings position
    const standingsMap = new Map<string, { rank: number; points: number }>();
    standings.forEach((standing, index) => {
      standingsMap.set(standing.id, {
        rank: index + 1,
        points: standing.points,
      });
    });

    // Assign seeds based on standings
    const seeded: BracketSeedData[] = [];
    const unseeded: typeof entries = [];

    for (const entry of entries) {
      const standing = standingsMap.get(entry.id);
      if (standing) {
        seeded.push({
          entryId: entry.id,
          seedNumber: 0, // Will be assigned after sorting
          seedingScore: standing.points,
        });
      } else {
        unseeded.push(entry);
      }
    }

    // Sort seeded by points (descending)
    seeded.sort((a, b) => (b.seedingScore || 0) - (a.seedingScore || 0));

    // Assign seed numbers
    seeded.forEach((seed, index) => {
      seed.seedNumber = index + 1;
    });

    // Randomly assign unseeded entries to remaining slots
    const unseededSeeds = unseeded
      .sort(() => Math.random() - 0.5)
      .map((entry, index) => ({
        entryId: entry.id,
        seedNumber: seeded.length + index + 1,
      }));

    return [...seeded, ...unseededSeeds];
  }

  // ============================================
  // Bracket Structure Generation
  // ============================================

  private async generateBracketStructure(
    bracketType: "single_elimination" | "double_elimination",
    seeds: BracketSeedData[],
    hasBronzeMatch: boolean
  ): Promise<RoundData[]> {
    if (bracketType === "single_elimination") {
      return this.generateSingleEliminationBracket(seeds, hasBronzeMatch);
    } else {
      return this.generateDoubleEliminationBracket(seeds);
    }
  }

  private generateSingleEliminationBracket(
    seeds: BracketSeedData[],
    hasBronzeMatch: boolean
  ): RoundData[] {
    const participantCount = seeds.length;
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(participantCount)));
    const byeCount = nextPowerOf2 - participantCount;

    const rounds: RoundData[] = [];
    const totalRounds = Math.ceil(Math.log2(participantCount));

    // Round 1: Quarterfinals, Round of 16, etc.
    const firstRoundMatches = nextPowerOf2 / 2;
    const firstRoundName = this.getRoundName(0, totalRounds, false);

    const firstRoundMatchData: MatchData[] = [];
    const seedPairings = this.generateStandardBracketPairings(
      participantCount,
      nextPowerOf2
    );

    for (let i = 0; i < firstRoundMatches; i++) {
      const [seedA, seedB] = seedPairings[i];
      const entryA = seeds.find((s) => s.seedNumber === seedA);
      const entryB = seeds.find((s) => s.seedNumber === seedB);

      // Check if this is a bye match (seedB > participantCount)
      const isBye = seedB > participantCount;

      firstRoundMatchData.push({
        matchNumber: i,
        entryAId: entryA?.entryId,
        entryBId: isBye ? undefined : entryB?.entryId,
        isByeMatch: isBye,
        winnerToMatchNumber: Math.floor(i / 2), // Winner advances to next round
      });
    }

    rounds.push({
      roundNumber: 0,
      roundName: firstRoundName,
      bracketType: "winners",
      matchesCount: firstRoundMatches,
      matches: firstRoundMatchData,
    });

    // Subsequent rounds
    let previousRoundMatches = firstRoundMatches;
    for (let round = 1; round < totalRounds; round++) {
      const matchesInRound = previousRoundMatches / 2;
      const roundName = this.getRoundName(round, totalRounds, false);

      const roundMatches: MatchData[] = [];
      for (let i = 0; i < matchesInRound; i++) {
        roundMatches.push({
          matchNumber: i,
          isByeMatch: false,
          winnerToMatchNumber:
            round < totalRounds - 1 ? Math.floor(i / 2) : undefined,
        });
      }

      rounds.push({
        roundNumber: round,
        roundName,
        bracketType: "winners",
        matchesCount: matchesInRound,
        matches: roundMatches,
      });

      previousRoundMatches = matchesInRound;
    }

    // Bronze match if requested
    if (hasBronzeMatch && totalRounds >= 2) {
      rounds.push({
        roundNumber: totalRounds,
        roundName: "Bronze Medal Match",
        bracketType: "bronze",
        matchesCount: 1,
        matches: [
          {
            matchNumber: 0,
            isByeMatch: false,
          },
        ],
      });
    }

    return rounds;
  }

  private generateDoubleEliminationBracket(
    seeds: BracketSeedData[]
  ): RoundData[] {
    const participantCount = seeds.length;
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(participantCount)));

    const rounds: RoundData[] = [];
    const totalWinnersRounds = Math.ceil(Math.log2(participantCount));

    // Winners bracket (same as single elimination for first half)
    const winnersRounds = this.generateSingleEliminationBracket(seeds, false);

    // Add winners bracket rounds
    for (const round of winnersRounds) {
      rounds.push({
        ...round,
        roundNumber: rounds.length,
      });
    }

    // Losers bracket structure
    // In double elimination, losers bracket has roughly 2x rounds
    const losersRoundsCount = (totalWinnersRounds - 1) * 2;

    for (let i = 0; i < losersRoundsCount; i++) {
      const matchesCount = Math.max(1, Math.floor(nextPowerOf2 / Math.pow(2, Math.floor(i / 2) + 2)));

      rounds.push({
        roundNumber: rounds.length,
        roundName: `Losers Round ${i + 1}`,
        bracketType: "losers",
        matchesCount,
        matches: Array.from({ length: matchesCount }, (_, j) => ({
          matchNumber: j,
          isByeMatch: false,
          winnerToMatchNumber: i < losersRoundsCount - 1 ? Math.floor(j / 2) : undefined,
        })),
      });
    }

    // Grand Final
    rounds.push({
      roundNumber: rounds.length,
      roundName: "Grand Final",
      bracketType: "winners",
      matchesCount: 1,
      matches: [
        {
          matchNumber: 0,
          isByeMatch: false,
        },
      ],
    });

    return rounds;
  }

  /**
   * Generate standard bracket pairings (1v16, 8v9, 5v12, 4v13, etc.)
   */
  private generateStandardBracketPairings(
    actualParticipants: number,
    nextPowerOf2: number
  ): [number, number][] {
    const pairings: [number, number][] = [];
    const halfSize = nextPowerOf2 / 2;

    for (let i = 1; i <= halfSize; i++) {
      const opponent = nextPowerOf2 + 1 - i;
      pairings.push([i, opponent]);
    }

    return pairings;
  }

  /**
   * Get round name based on position
   */
  private getRoundName(
    roundIndex: number,
    totalRounds: number,
    isBronze: boolean
  ): string {
    if (isBronze) return "Bronze Medal Match";

    const remainingRounds = totalRounds - roundIndex;

    if (remainingRounds === 1) return "Final";
    if (remainingRounds === 2) return "Semifinals";
    if (remainingRounds === 3) return "Quarterfinals";
    if (remainingRounds === 4) return "Round of 16";
    if (remainingRounds === 5) return "Round of 32";

    return `Round ${roundIndex + 1}`;
  }

  // ============================================
  // Match Creation
  // ============================================

  private async createRoundsAndMatches(
    bracketConfigId: string,
    tournamentId: string,
    rounds: RoundData[],
    tx: any
  ) {
    const createdRounds = await bracketRepository.createRounds(
      rounds.map((r) => ({
        bracketConfigId,
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        bracketType: r.bracketType,
        matchesCount: r.matchesCount,
      })),
      tx
    );

    // Create matches for each round
    const tournament = await tournamentRepository.getById(tournamentId);
    const startDate = new Date(tournament!.startDate);

    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const createdRound = createdRounds[i];

      for (const matchData of round.matches) {
        // Calculate match date (spread over tournament duration)
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + round.roundNumber * 3);

        // Create match record
        const [matchRecord] = await tx
          .insert(matches)
          .values({
            tournamentId,
            status: "scheduled",
            playedAt: matchDate,
          })
          .returning();

        // Create match sides if entries specified
        if (matchData.entryAId) {
          await tx
            .insert(matchSides)
            .values({
              matchId: matchRecord.id,
              entryId: matchData.entryAId,
              position: 0,
              score: 0,
              pointsAwarded: 0,
            });
        }

        if (matchData.entryBId) {
          await tx
            .insert(matchSides)
            .values({
              matchId: matchRecord.id,
              entryId: matchData.entryBId,
              position: 1,
              score: 0,
              pointsAwarded: 0,
            });
        }

        // Create match metadata
        await bracketRepository.createMatchMetadata(
          {
            matchId: matchRecord.id,
            bracketRoundId: createdRound.id,
            matchNumber: matchData.matchNumber,
            isByeMatch: matchData.isByeMatch,
          },
          tx
        );
      }
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  private calculateRoundsCount(
    participantCount: number,
    bracketType: "single_elimination" | "double_elimination"
  ): number {
    const singleElimRounds = Math.ceil(Math.log2(participantCount));

    if (bracketType === "single_elimination") {
      return singleElimRounds;
    } else {
      // Double elimination has approximately 2x rounds
      return singleElimRounds + (singleElimRounds - 1) * 2 + 1; // +1 for grand final
    }
  }
}

export const bracketService = new BracketService();
