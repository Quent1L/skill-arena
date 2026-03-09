import { bracketRepository } from "../repository/bracket.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { entryRepository } from "../repository/entry.repository";
import { matchRepository } from "../repository/match.repository";
import { participantRepository } from "../repository/participant.repository";
import { standingsService } from "./standings.service";
import { standingsRepository } from "../repository/standings.repository";
import { tournamentService } from "./tournament.service";
import { notificationService } from "./notification.service";
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
  winnerToRoundNumber?: number;
  loserToMatchNumber?: number;
  loserToRoundNumber?: number;
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
        // Delete action notifications for all bracket matches before removing them
        const existingMatches = await matchRepository.list({ tournamentId });
        for (const match of existingMatches) {
          await notificationService.deleteActionsByMatchId(match.id);
        }
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

    const participants = await participantRepository.findTournamentParticipants(tournamentId);

    return {
      canGenerate: true,
      matchCount: matches.length,
      currentParticipants: participants.length,
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

    // Delete action notifications for all bracket matches before removing them
    const existingMatches = await matchRepository.list({ tournamentId });
    for (const match of existingMatches) {
      await notificationService.deleteActionsByMatchId(match.id);
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
      await this.validateParticipantsPlayedInChampionship(
        tournamentId,
        input.sourceTournamentId!
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

  private async validateParticipantsPlayedInChampionship(
    tournamentId: string,
    sourceTournamentId: string
  ) {
    const participants = await participantRepository.findTournamentParticipants(tournamentId);
    if (participants.length === 0) return;

    const sourceMatches = await standingsRepository.getMatchesForStandings(
      sourceTournamentId,
      ["finalized"]
    );

    const playersWithMatches = new Set<string>();
    if (sourceMatches.length > 0) {
      const sides = await standingsRepository.getMatchSides(
        sourceMatches.map((m) => m.id)
      );
      for (const side of sides) {
        for (const ep of side.entry?.players ?? []) {
          playersWithMatches.add(ep.playerId);
        }
      }
    }

    const missing = participants.filter((p) => !playersWithMatches.has(p.userId));

    if (missing.length > 0) {
      throw new BadRequestError(
        ErrorCode.CHAMPIONSHIP_PARTICIPANTS_WITHOUT_MATCHES,
        {
          participants: missing.map((p) => ({
            id: p.userId,
            name: p.user.displayName,
          })),
        }
      );
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
      const semiFinalRoundIndex = totalRounds - 2;
      rounds[semiFinalRoundIndex] = {
        ...rounds[semiFinalRoundIndex],
        matches: rounds[semiFinalRoundIndex].matches.map((m) => ({
          ...m,
          loserToMatchNumber: 0,
          loserToRoundNumber: totalRounds,
        })),
      };

      rounds.push({
        roundNumber: totalRounds,
        roundName: "Match pour la 3ème place",
        bracketType: "bronze",
        matchesCount: 1,
        matches: [{ matchNumber: 0, isByeMatch: false }],
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

    // Enrich winners rounds with loser destinations
    const winnersRoundsLength = winnersRounds.length;
    for (let k = 0; k < winnersRounds.length; k++) {
      const lbIndex = k === 0 ? 0 : 2 * k - 1;
      const loserToRoundNumber = winnersRoundsLength + lbIndex;
      winnersRounds[k] = {
        ...winnersRounds[k],
        matches: winnersRounds[k].matches.map((m) => ({
          ...m,
          loserToMatchNumber: k === 0 ? Math.floor(m.matchNumber / 2) : m.matchNumber,
          loserToRoundNumber,
        })),
      };
    }

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
        roundName: `Tableau des perdants - Tour ${i + 1}`,
        bracketType: "losers",
        matchesCount,
        matches: Array.from({ length: matchesCount }, (_, j) => ({
          matchNumber: j,
          isByeMatch: false,
          winnerToMatchNumber: i < losersRoundsCount - 1 ? (i % 2 === 0 ? j : Math.floor(j / 2)) : undefined,
        })),
      });
    }

    const grandFinalRoundNumber = rounds.length;

    // Link last losers round winner → Grande Finale
    const lastLosersIdx = rounds.length - 1;
    rounds[lastLosersIdx] = {
      ...rounds[lastLosersIdx],
      matches: rounds[lastLosersIdx].matches.map((m) => ({
        ...m,
        winnerToMatchNumber: 0,
      })),
    };

    // Link winners final winner → Grande Finale (cross-bracket, needs explicit round override)
    const winnersFinalIdx = winnersRounds.length - 1;
    rounds[winnersFinalIdx] = {
      ...rounds[winnersFinalIdx],
      matches: rounds[winnersFinalIdx].matches.map((m) => ({
        ...m,
        winnerToMatchNumber: 0,
        winnerToRoundNumber: grandFinalRoundNumber,
      })),
    };

    // Grand Final
    rounds.push({
      roundNumber: grandFinalRoundNumber,
      roundName: "Grande Finale",
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
    if (isBronze) return "Match pour la 3ème place";

    const remainingRounds = totalRounds - roundIndex;

    if (remainingRounds === 1) return "Finale";
    if (remainingRounds === 2) return "Demi-finales";
    if (remainingRounds === 3) return "Quarts de finale";
    if (remainingRounds === 4) return "Huitièmes de finale";
    if (remainingRounds === 5) return "Seizièmes de finale";

    return `Tour ${roundIndex + 1}`;
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

    const tournament = await tournamentRepository.getById(tournamentId);
    const startDate = new Date(tournament!.startDate);

    // Map "roundNumber:matchNumber" → matchId for pass 2
    const matchIdMap = new Map<string, string>();
    const pendingLinks: {
      matchId: string;
      roundNumber: number;
      winnerToMatchNumber: number;
      winnerToRoundNumber?: number;
    }[] = [];
    const pendingLoserLinks: {
      matchId: string;
      loserToMatchNumber: number;
      loserToRoundNumber: number;
    }[] = [];

    // Pass 1: Create all matches and metadata
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const createdRound = createdRounds[i];

      for (const matchData of round.matches) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + round.roundNumber * 3);

        const [matchRecord] = await tx
          .insert(matches)
          .values({ tournamentId, status: "scheduled", playedAt: matchDate })
          .returning();

        matchIdMap.set(`${round.roundNumber}:${matchData.matchNumber}`, matchRecord.id);

        if (matchData.entryAId) {
          await tx.insert(matchSides).values({
            matchId: matchRecord.id,
            entryId: matchData.entryAId,
            position: 0,
            score: 0,
            pointsAwarded: 0,
          });
        }

        if (matchData.entryBId) {
          await tx.insert(matchSides).values({
            matchId: matchRecord.id,
            entryId: matchData.entryBId,
            position: 1,
            score: 0,
            pointsAwarded: 0,
          });
        }

        await bracketRepository.createMatchMetadata(
          {
            matchId: matchRecord.id,
            bracketRoundId: createdRound.id,
            matchNumber: matchData.matchNumber,
            isByeMatch: matchData.isByeMatch,
          },
          tx
        );

        if (matchData.winnerToMatchNumber !== undefined) {
          pendingLinks.push({
            matchId: matchRecord.id,
            roundNumber: round.roundNumber,
            winnerToMatchNumber: matchData.winnerToMatchNumber,
            winnerToRoundNumber: matchData.winnerToRoundNumber,
          });
        }

        if (
          matchData.loserToMatchNumber !== undefined &&
          matchData.loserToRoundNumber !== undefined
        ) {
          pendingLoserLinks.push({
            matchId: matchRecord.id,
            loserToMatchNumber: matchData.loserToMatchNumber,
            loserToRoundNumber: matchData.loserToRoundNumber,
          });
        }
      }
    }

    // Pass 2: Link winnerToMatchId using the map
    for (const item of pendingLinks) {
      const targetRound = item.winnerToRoundNumber ?? item.roundNumber + 1;
      const key = `${targetRound}:${item.winnerToMatchNumber}`;
      const nextMatchId = matchIdMap.get(key);
      if (nextMatchId) {
        await bracketRepository.updateMatchMetadata(
          item.matchId,
          { winnerToMatchId: nextMatchId },
          tx
        );
      }
    }

    for (const item of pendingLoserLinks) {
      const key = `${item.loserToRoundNumber}:${item.loserToMatchNumber}`;
      const loserMatchId = matchIdMap.get(key);
      if (loserMatchId) {
        await bracketRepository.updateMatchMetadata(
          item.matchId,
          { loserToMatchId: loserMatchId },
          tx
        );
      }
    }
  }

  // ============================================
  // Winner Advancement
  // ============================================

  /**
   * After a match is finalized, place the winner in the next bracket match
   */
  async advanceWinnerToNextRound(matchId: string) {
    const metadata = await bracketRepository.getMetadataByMatchId(matchId);
    if (!metadata?.winnerToMatchId) return;

    const match = await matchRepository.getById(matchId);
    if (!match?.winnerSide) return;

    const winnerPosition = match.winnerSide === "A" ? 0 : 1;
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
    });

    const winnerSide = sides.find((s) => s.position === winnerPosition);
    if (!winnerSide) return;

    const nextMatchSides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, metadata.winnerToMatchId),
    });

    if (nextMatchSides.some((s) => s.entryId === winnerSide.entryId)) return;
    if (nextMatchSides.length >= 2) return;

    await db.insert(matchSides).values({
      matchId: metadata.winnerToMatchId,
      entryId: winnerSide.entryId,
      position: nextMatchSides.length,
      score: 0,
      pointsAwarded: 0,
    });
  }

  /**
   * After a match is finalized, place the loser in the losers bracket (double elimination)
   */
  async advanceLoserToNextRound(matchId: string) {
    const metadata = await bracketRepository.getMetadataByMatchId(matchId);
    if (!metadata?.loserToMatchId) return;

    const match = await matchRepository.getById(matchId);
    if (!match?.winnerSide) return;

    const loserPosition = match.winnerSide === "A" ? 1 : 0;
    const sides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, matchId),
    });

    const loserSide = sides.find((s) => s.position === loserPosition);
    if (!loserSide) return;

    const nextMatchSides = await db.query.matchSides.findMany({
      where: eq(matchSides.matchId, metadata.loserToMatchId),
    });

    if (nextMatchSides.some((s) => s.entryId === loserSide.entryId)) return;
    if (nextMatchSides.length >= 2) return;

    await db.insert(matchSides).values({
      matchId: metadata.loserToMatchId,
      entryId: loserSide.entryId,
      position: nextMatchSides.length,
      score: 0,
      pointsAwarded: 0,
    });
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
