import { matchRepository } from "../repository/match.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { db } from "../config/database";
import { matches } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  type CreateMatchRequestData as CreateMatchInput,
  type UpdateMatchRequestData as UpdateMatchInput,
  type ReportMatchResultRequestData as ReportMatchResultInput,
  type ConfirmMatchResultRequestData as ConfirmMatchResultInput,
  type MatchStatus,
  type BaseTournament,
} from "@skill-arena/shared/types/index";
import {
  ErrorCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  AppError,
} from "../types/errors";
import i18next from "../config/i18n";
import type { UpdateMatchData } from "../repository/match.repository";

type TournamentFromRepository = Awaited<
  ReturnType<typeof matchRepository.getTournament>
>;

export class MatchService {
  /**
   * Check if user can manage matches in tournament
   */
  async canManageMatches(
    tournamentId: string,
    userId: string
  ): Promise<boolean> {
    const user = await userRepository.getById(userId);
    if (!user) return false;
    if (user.role === "super_admin") return true;

    // Check if user is tournament admin
    return await tournamentRepository.isUserTournamentAdmin(
      tournamentId,
      userId
    );
  }

  /**
   * Create a new match
   */
  async createMatch(input: CreateMatchInput, createdBy: string) {
    const tournament = await this.getAndValidateTournament(input.tournamentId);
    await this.checkCreatePermissions(input, createdBy, tournament);
    await this.validateMatchInput(input, tournament);
    await this.validateMatchRules(input, tournament);

    const match = await this.createMatchRecord(input);
    await this.createMatchParticipations(input, tournament, match.id);

    return await matchRepository.getById(match.id);
  }

  /**
   * Get and validate tournament exists and is in valid status
   */
  private async getAndValidateTournament(tournamentId: string) {
    const tournament = await matchRepository.getTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    if (!["open", "ongoing"].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS);
    }

    return tournament;
  }

  /**
   * Check if user has permission to create match
   */
  private async checkCreatePermissions(
    input: CreateMatchInput,
    createdBy: string,
    tournament: NonNullable<TournamentFromRepository>
  ) {
    if (this.isPlayerInMatch(input, createdBy)) {
      return;
    }

    const canManage = await this.canManageMatches(
      input.tournamentId,
      createdBy
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }
  }

  /**
   * Validate match input based on team mode
   */
  private async validateMatchInput(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>
  ) {
    if (tournament.teamMode === "static") {
      await this.validateStaticTeamInput(input);
    } else if (tournament.teamMode === "flex") {
      await this.validateFlexTeamInput(input);
    }
  }

  /**
   * Validate static team input
   */
  private async validateStaticTeamInput(input: CreateMatchInput) {
    if (!input.teamAId || !input.teamBId) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_TEAMS);
    }
    await matchRepository.validateTeamsForTournament(
      input.tournamentId,
      input.teamAId,
      input.teamBId
    );
  }

  /**
   * Validate flex team input
   */
  private async validateFlexTeamInput(input: CreateMatchInput) {
    if (
      !input.playerIdsA ||
      !input.playerIdsB ||
      input.playerIdsA.length === 0 ||
      input.playerIdsB.length === 0
    ) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_PLAYERS);
    }
    await matchRepository.validatePlayersForTournament(input.tournamentId, [
      ...input.playerIdsA,
      ...input.playerIdsB,
    ]);
  }

  /**
   * Create match record in database
   */
  private async createMatchRecord(input: CreateMatchInput) {
    const matchData = {
      tournamentId: input.tournamentId,
      round: input.round,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      status: input.status ?? ("scheduled" as const),
    };

    return await matchRepository.create(matchData);
  }

  /**
   * Create match participations for flex teams
   */
  private async createMatchParticipations(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    matchId: string
  ) {
    if (
      tournament.teamMode !== "flex" ||
      !input.playerIdsA ||
      !input.playerIdsB
    ) {
      return;
    }

    const participations = [
      ...input.playerIdsA.map((playerId: string) => ({
        matchId,
        playerId,
        teamSide: "A" as const,
      })),
      ...input.playerIdsB.map((playerId: string) => ({
        matchId,
        playerId,
        teamSide: "B" as const,
      })),
    ];

    for (const participation of participations) {
      await matchRepository.createMatchParticipation(participation);
    }
  }

  private isPlayerInMatch(input: CreateMatchInput, playerId: string) {
    if (input.playerIdsA?.includes(playerId)) {
      return true;
    }
    if (input.playerIdsB?.includes(playerId)) {
      return true;
    }
    return false;
  }

  /**
   * Validate match rules against tournament settings
   */
  private async validateMatchRules(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>
  ) {
    if (
      tournament.teamMode === "flex" &&
      input.playerIdsA &&
      input.playerIdsB
    ) {
      await this.validateFlexTeamRules(input, tournament);
    } else if (
      tournament.teamMode === "static" &&
      input.teamAId &&
      input.teamBId
    ) {
      // For static teams, check team constraints
      // TODO: Implement static team validation - need to get team participants and check rules
    }
  }

  /**
   * Validate flex team match rules
   */
  private async validateFlexTeamRules(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>
  ) {
    if (!input.playerIdsA || !input.playerIdsB) return;

    if (input.playerIdsA.length !== input.playerIdsB.length) {
      throw new BadRequestError(ErrorCode.MATCH_TEAM_SIZE_MISMATCH, {
        teamASize: input.playerIdsA.length,
        teamBSize: input.playerIdsB.length,
      });
    }

    const allPlayerIds = [...input.playerIdsA, ...input.playerIdsB];
    const excludeMatchId = input.matchId; // Exclude match being edited from validation

    for (const playerId of allPlayerIds) {
      await this.validatePlayerMatchLimit(tournament, playerId, excludeMatchId);
      await this.validatePartnerConstraints(input, tournament, playerId, excludeMatchId);
      await this.validateOpponentConstraints(input, tournament, playerId, excludeMatchId);
    }
  }

  /**
   * Get player display name
   */
  private async getPlayerName(playerId: string): Promise<string> {
    const player = await userRepository.getById(playerId);
    return player?.displayName || `Joueur ${playerId.substring(0, 8)}`;
  }

  /**
   * Validate max matches per player
   */
  private async validatePlayerMatchLimit(
    tournament: NonNullable<TournamentFromRepository>,
    playerId: string,
    excludeMatchId?: string
  ) {
    const playerMatchCount = await matchRepository.countMatchesForUser(
      tournament.id,
      playerId,
      excludeMatchId
    );
    if (playerMatchCount >= tournament.maxMatchesPerPlayer) {
      const playerName = await this.getPlayerName(playerId);
      throw new ConflictError(ErrorCode.MAX_MATCHES_EXCEEDED, {
        max: tournament.maxMatchesPerPlayer,
        playerName,
      });
    }
  }

  /**
   * Validate partner constraints
   */
  private async validatePartnerConstraints(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>,
    playerId: string,
    excludeMatchId?: string
  ) {
    if (!input.playerIdsA) return;

    for (const otherPlayerId of input.playerIdsA) {
      if (otherPlayerId !== playerId) {
        const partnerCount =
          await matchRepository.countMatchesWithSamePartner(
            tournament.id,
            playerId,
            otherPlayerId,
            excludeMatchId
          );
        if (partnerCount >= tournament.maxTimesWithSamePartner) {
          const [playerName, partnerName] = await Promise.all([
            this.getPlayerName(playerId),
            this.getPlayerName(otherPlayerId),
          ]);
          throw new ConflictError(ErrorCode.MAX_PARTNER_MATCHES_EXCEEDED, {
            max: tournament.maxTimesWithSamePartner,
            playerName,
            partnerName,
          });
        }
      }
    }
  }

  /**
   * Validate opponent constraints
   */
  private async validateOpponentConstraints(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>,
    playerId: string,
    excludeMatchId?: string
  ) {
    if (!input.playerIdsB) return;

    for (const otherPlayerId of input.playerIdsB) {
      const opponentCount = await matchRepository.countMatchesWithSameOpponent(
        tournament.id,
        playerId,
        otherPlayerId,
        excludeMatchId
      );
      if (opponentCount >= tournament.maxTimesWithSameOpponent) {
        const [playerName, opponentName] = await Promise.all([
          this.getPlayerName(playerId),
          this.getPlayerName(otherPlayerId),
        ]);
        throw new ConflictError(ErrorCode.MAX_OPPONENT_MATCHES_EXCEEDED, {
          max: tournament.maxTimesWithSameOpponent,
          playerName,
          opponentName,
        });
      }
    }
  }

  /**
   * Get match by ID
   */
  async getMatchById(id: string) {
    const match = await matchRepository.getById(id);
    if (!match) {
      throw new NotFoundError(ErrorCode.MATCH_NOT_FOUND);
    }
    return match;
  }

  /**
   * List matches with optional filters
   */
  async listMatches(filters?: {
    tournamentId?: string;
    status?: MatchStatus;
    round?: number;
  }) {
    return await matchRepository.list(filters);
  }

  /**
   * Update match
   */
  async updateMatch(id: string, input: UpdateMatchInput, updatedBy: string) {
    const match = await this.getMatchById(id);

    // Check permissions
    const canManage = await this.canManageMatches(
      match.tournamentId,
      updatedBy
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Can only update certain fields based on status
    if (match.status === "confirmed") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_CONFIRMED);
    }

    const updateData: UpdateMatchData = {};
    if (input.round !== undefined) updateData.round = input.round;
    if (input.scoreA !== undefined) updateData.scoreA = input.scoreA;
    if (input.scoreB !== undefined) updateData.scoreB = input.scoreB;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.reportProof !== undefined)
      updateData.reportProof = input.reportProof;
    if (input.outcomeTypeId !== undefined)
      updateData.outcomeTypeId = input.outcomeTypeId;
    if (input.outcomeReasonId !== undefined)
      updateData.outcomeReasonId = input.outcomeReasonId;

    return await matchRepository.update(id, updateData);
  }

  /**
   * Delete match
   */
  async deleteMatch(id: string, deletedBy: string) {
    const match = await this.getMatchById(id);

    // Check permissions
    const canManage = await this.canManageMatches(
      match.tournamentId,
      deletedBy
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Can only delete if not confirmed
    if (match.status === "confirmed") {
      throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_DELETED);
    }

    // Delete participations first (cascade should handle this, but let's be safe)
    await matchRepository.deleteMatchParticipation(id);

    await matchRepository.delete(id);

    return { success: true, message: "Match supprimé avec succès" };
  }

  /**
   * Report match result
   */
  async reportMatchResult(
    id: string,
    input: ReportMatchResultInput,
    reportedBy: string
  ) {
    const match = await this.getMatchById(id);
    await this.validateReportPermissions(id, reportedBy);
    await this.validateReportStatus(match.status);
    await this.validateScores(input);
    await this.validateDrawAllowed(match.tournamentId, input);

    const updateData = this.buildReportUpdateData(input, match, reportedBy);
    return await matchRepository.update(id, updateData);
  }

  /**
   * Validate user can report match
   */
  private async validateReportPermissions(matchId: string, userId: string) {
    const isParticipant = await matchRepository.isUserInMatch(matchId, userId);
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
    }
  }

  /**
   * Validate match status allows reporting
   */
  private validateReportStatus(status: MatchStatus) {
    if (!["scheduled", "reported", "pending_confirmation"].includes(status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
    }
  }

  /**
   * Validate scores are non-negative
   */
  private validateScores(input: ReportMatchResultInput) {
    if (input.scoreA < 0 || input.scoreB < 0) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_SCORE);
    }
  }

  /**
   * Validate draw is allowed if scores are equal
   */
  private async validateDrawAllowed(
    tournamentId: string,
    input: ReportMatchResultInput
  ) {
    if (input.scoreA !== input.scoreB) {
      return;
    }

    const tournament = await matchRepository.getTournament(tournamentId);
    if (!tournament?.allowDraw) {
      throw new BadRequestError(ErrorCode.MATCH_DRAW_NOT_ALLOWED);
    }
  }

  /**
   * Build update data for match result report
   */
  private buildReportUpdateData(
    input: ReportMatchResultInput,
    match: Awaited<ReturnType<typeof matchRepository.getById>>,
    reportedBy: string
  ): UpdateMatchData {
    const updateData: UpdateMatchData = {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      reportedBy,
      reportedAt: new Date(),
      status: "reported",
      reportProof: input.reportProof,
    };

    if (input.scoreA > input.scoreB) {
      updateData.winnerId = match?.teamAId || undefined;
    } else if (input.scoreB > input.scoreA) {
      updateData.winnerId = match?.teamBId || undefined;
    }

    return updateData;
  }

  /**
   * Confirm match result
   */
  async confirmMatchResult(
    id: string,
    input: ConfirmMatchResultInput,
    confirmedBy: string
  ) {
    const match = await this.getMatchById(id);

    // Check if user is participant in the match
    const isParticipant = await matchRepository.isUserInMatch(id, confirmedBy);
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
    }

    // Check if match is in reported state
    if (match.status !== "reported") {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
    }

    // Check if same user who reported is not confirming
    if (match.reportedBy === confirmedBy) {
      throw new BadRequestError(ErrorCode.MATCH_SAME_REPORTER_CONFIRMER);
    }

    if (input.confirmed) {
      return await matchRepository.update(id, {
        status: "confirmed",
        confirmationBy: confirmedBy,
        confirmationAt: new Date(),
      });
    } else {
      // Dispute the result
      return await matchRepository.update(id, {
        status: "disputed",
      });
    }
  }

  /**
   * Validate match possibility (partial validation for frontend)
   */
  async validateMatch(input: CreateMatchInput & { matchId?: string }) {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const tournament = await this.getTournamentForValidation(input);
      if (!tournament) {
        errors.push("Tournoi non trouvé");
        return { valid: false, errors, warnings };
      }

      if (!this.isTournamentOpenForMatches(tournament)) {
        errors.push(
          "Le tournoi doit être ouvert ou en cours pour créer des matchs"
        );
        return { valid: false, errors, warnings };
      }

      await this.validateMatchInputForValidation(input, tournament, errors);
      await this.validateTournamentRulesForValidation(
        input,
        tournament,
        errors
      );
      await this.checkSimilarMatch(input, warnings, input.matchId);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          teamMode: tournament.teamMode,
          status: tournament.status,
        },
      };
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Erreur inattendue lors de la validation"
      );
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Get tournament for validation
   */
  private async getTournamentForValidation(input: CreateMatchInput) {
    return await matchRepository.getTournament(input.tournamentId);
  }

  /**
   * Check if tournament is open for creating matches
   */
  private isTournamentOpenForMatches(
    tournament: TournamentFromRepository
  ): boolean {
    return tournament ? ["open", "ongoing"].includes(tournament.status) : false;
  }

  /**
   * Validate match input based on team mode
   */
  private async validateMatchInputForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[]
  ) {
    if (tournament.teamMode === "static") {
      await this.validateStaticTeamsForValidation(input, errors);
    } else if (tournament.teamMode === "flex") {
      await this.validateFlexPlayersForValidation(input, errors);
    }
  }

  /**
   * Validate static teams for validation
   */
  private async validateStaticTeamsForValidation(
    input: CreateMatchInput,
    errors: string[]
  ) {
    if (input.teamAId) {
      await this.validateTeamForValidation(
        input.tournamentId,
        input.teamAId,
        undefined,
        errors,
        "équipe A"
      );
    }

    if (input.teamBId) {
      await this.validateTeamForValidation(
        input.tournamentId,
        undefined,
        input.teamBId,
        errors,
        "équipe B"
      );
    }

    if (input.teamAId && input.teamBId && input.teamAId === input.teamBId) {
      errors.push("Les deux équipes ne peuvent pas être identiques");
    }
  }

  /**
   * Validate team for validation (helper)
   */
  private async validateTeamForValidation(
    tournamentId: string,
    teamAId: string | undefined,
    teamBId: string | undefined,
    errors: string[],
    teamLabel: string
  ) {
    try {
      await matchRepository.validateTeamsForTournament(
        tournamentId,
        teamAId,
        teamBId
      );
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `Erreur de validation ${teamLabel}`
      );
    }
  }

  /**
   * Validate flex players for validation
   */
  private async validateFlexPlayersForValidation(
    input: CreateMatchInput,
    errors: string[]
  ) {
    if (input.playerIdsA) {
      await this.validatePlayersForValidation(
        input.tournamentId,
        input.playerIdsA,
        errors,
        "joueurs équipe A"
      );
    }

    if (input.playerIdsB) {
      await this.validatePlayersForValidation(
        input.tournamentId,
        input.playerIdsB,
        errors,
        "joueurs équipe B"
      );
    }

    if (input.playerIdsA && input.playerIdsB) {
      await this.checkOverlappingPlayers(input, errors);
    }
  }

  /**
   * Validate players for validation (helper)
   */
  private async validatePlayersForValidation(
    tournamentId: string,
    playerIds: string[],
    errors: string[],
    label: string
  ) {
    try {
      await matchRepository.validatePlayersForTournament(tournamentId, playerIds);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `Erreur de validation ${label}`
      );
    }
  }

  /**
   * Check for overlapping players between teams
   */
  private async checkOverlappingPlayers(
    input: CreateMatchInput,
    errors: string[]
  ) {
    if (!input.playerIdsA || !input.playerIdsB) return;

    const overlappingPlayers = input.playerIdsA.filter((playerId: string) =>
      input.playerIdsB?.includes(playerId)
    );
    if (overlappingPlayers.length > 0) {
      // Get the name of the first overlapping player
      const firstOverlappingPlayerId = overlappingPlayers[0];
      const playerName = await this.getPlayerName(firstOverlappingPlayerId);
      const errorMessage = String(
        i18next.t("errors.MATCH_OVERLAPPING_PLAYERS", { playerName })
      );
      errors.push(errorMessage);
    }
  }

  /**
   * Validate tournament rules for validation
   */
  private async validateTournamentRulesForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[]
  ) {
    if (
      tournament.teamMode === "flex" &&
      input.playerIdsA &&
      input.playerIdsB
    ) {
      try {
        await this.validateMatchRules(input, tournament);
      } catch (error) {
        if (error instanceof AppError) {
          // Translate the error using i18n
          const translatedMessage = String(
            i18next.t(`errors.${error.code}`, error.details || {})
          );
          errors.push(translatedMessage);
        } else {
          // Fallback for non-AppError errors
          const fallbackMessage = String(i18next.t("errors.UNKNOWN"));
          errors.push(
            error instanceof Error ? error.message : fallbackMessage
          );
        }
      }
    }
  }

  /**
   * Check if similar match already exists
   */
  private async checkSimilarMatch(
    input: CreateMatchInput & { matchId?: string },
    warnings: string[],
    excludeMatchId?: string
  ) {
    if (!input.teamAId || !input.teamBId) return;

    const conditions = [
      eq(matches.tournamentId, input.tournamentId),
      eq(matches.teamAId, input.teamAId),
      eq(matches.teamBId, input.teamBId),
    ];

    // Exclude the match being edited
    if (excludeMatchId) {
      conditions.push(ne(matches.id, excludeMatchId));
    }

    const existingMatch = await db.query.matches.findFirst({
      where: and(...conditions),
    });

    if (existingMatch) {
      warnings.push("Un match similaire existe déjà");
    }
  }
}

export const matchService = new MatchService();
