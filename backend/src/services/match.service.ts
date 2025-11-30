import { matchRepository } from "../repository/match.repository";
import { matchConfirmationRepository } from "../repository/match-confirmation.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { db } from "../config/database";
import { matches } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  type CreateMatchRequestData as CreateMatchInput,
  type UpdateMatchRequestData as UpdateMatchInput,
  type ReportMatchResultRequestData as ReportMatchResultInput,
  type ConfirmMatchRequestData as ConfirmMatchInput,
  type ContestMatchRequestData as ContestMatchInput,
  type FinalizeMatchRequestData as FinalizeMatchInput,
  type MatchStatus,
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
import { notificationService } from "./notification.service";
import { matchInputValidator } from "./validators/match-input.validator";
import { matchRuleValidator } from "./validators/match-rule.validator";
import { matchPermissionValidator } from "./validators/match-permission.validator";
import { matchStatusValidator } from "./validators/match-status.validator";

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
    return await matchPermissionValidator.canManageMatches(tournamentId, userId);
  }

  /**
   * Create a new match
   */
  async createMatch(input: CreateMatchInput, createdBy: string) {
    const tournament = await this.getAndValidateTournament(input.tournamentId);
    await this.checkCreatePermissions(input, createdBy, tournament);
    await this.validateMatchInput(input, tournament);
    await this.validateMatchRules(input, tournament);

    const match = await this.createMatchRecord(input, createdBy);
    await this.createMatchParticipations(input, tournament, match.id);

    // If match is reported, create automatic confirmation for the creator
    if (input.status === "reported") {
      await matchConfirmationRepository.upsert({
        matchId: match.id,
        playerId: createdBy,
        isConfirmed: true,
        isContested: false,
      });

      // Check if match can be validated immediately
      await this.checkAndFinalizeMatch(match.id);
    }

    await this.notifyMatchCreated(match.id, createdBy, tournament.name);

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
    await matchPermissionValidator.checkCreatePermissions(input, createdBy, tournament);
  }

  /**
   * Validate match input based on team mode
   */
  private async validateMatchInput(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>
  ) {
    await matchInputValidator.validateMatchInput(input, tournament);
  }

  /**
   * Create match record in database
   */
  private async createMatchRecord(input: CreateMatchInput, createdBy: string) {
    const matchData: any = {
      tournamentId: input.tournamentId,
      round: input.round,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      status: input.status ?? ("scheduled" as const),
    };

    // If match is being reported (not just scheduled), include score and report fields
    if (
      input.status === "reported" &&
      input.scoreA !== undefined &&
      input.scoreB !== undefined
    ) {
      matchData.scoreA = input.scoreA;
      matchData.scoreB = input.scoreB;
      matchData.reportProof = input.reportProof;
      matchData.outcomeTypeId = input.outcomeTypeId;
      matchData.outcomeReasonId = input.outcomeReasonId;
      matchData.reportedBy = createdBy;
      matchData.reportedAt = new Date();

      // Calculate confirmation deadline (72 hours from now)
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + 72);
      matchData.confirmationDeadline = confirmationDeadline;

      // Determine winner side and winnerId
      // Priority 1: Use explicit winner selection from user (handles forfeit, abandon, etc.)
      if (input.winner) {
        matchData.winnerSide = input.winner === "teamA" ? "A" : "B";
        matchData.winnerId =
          input.winner === "teamA" ? input.teamAId : input.teamBId;
      }
      // Priority 2: If no explicit winner but winner is explicitly null (draw)
      else if (input.winner === null) {
        // Match nul - winnerSide and winnerId remain undefined
      }
      // Priority 3: Fall back to score-based calculation (if winner field was not provided)
      else if (input.winner === undefined) {
        if (input.scoreA > input.scoreB) {
          matchData.winnerSide = "A";
          matchData.winnerId = input.teamAId; // For static teams
        } else if (input.scoreB > input.scoreA) {
          matchData.winnerSide = "B";
          matchData.winnerId = input.teamBId; // For static teams
        }
        // If scores are equal, no winner (draw) - winnerSide and winnerId remain undefined
      }
    }

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



  /**
   * Validate match rules against tournament settings
   */
  private async validateMatchRules(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>
  ) {
    await matchRuleValidator.validateMatchRules(input, tournament);
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

    // Calculate confirmation deadline (72 hours from now)
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 72);
    updateData.confirmationDeadline = confirmationDeadline;

    const updatedMatch = await matchRepository.update(id, updateData);

    // Create automatic confirmation for the reporter
    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: reportedBy,
      isConfirmed: true,
      isContested: false,
    });

    // Check if match can be validated immediately
    await this.checkAndFinalizeMatch(id);

    return updatedMatch;
  }

  /**
   * Validate user can report match
   */
  private async validateReportPermissions(matchId: string, userId: string) {
    await matchPermissionValidator.validateReportPermissions(matchId, userId);
  }

  /**
   * Validate match status allows reporting
   */
  private validateReportStatus(status: MatchStatus) {
    matchStatusValidator.validateReportStatus(status);
  }

  /**
   * Validate scores are non-negative
   */
  private validateScores(input: ReportMatchResultInput) {
    matchInputValidator.validateScores(input.scoreA, input.scoreB);
  }

  /**
   * Validate draw is allowed if scores are equal
   */
  private async validateDrawAllowed(
    tournamentId: string,
    input: ReportMatchResultInput
  ) {
    await matchInputValidator.validateDrawAllowed(tournamentId, input.scoreA, input.scoreB);
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
      updateData.winnerSide = "A";
      updateData.winnerId = match?.teamAId || undefined;
    } else if (input.scoreB > input.scoreA) {
      updateData.winnerSide = "B";
      updateData.winnerId = match?.teamBId || undefined;
    }
    // If equal, no winner (draw) - winnerSide and winnerId remain undefined

    return updateData;
  }

  /**
   * Confirm match result
   */
  async confirmMatch(
    id: string,
    input: ConfirmMatchInput,
    confirmedBy: string
  ) {
    const match = await this.getMatchById(id);

    // Check if user is participant in the match
    const isParticipant = await matchRepository.isUserInMatch(id, confirmedBy);
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
    }

    // Check if match is in reported state
    if (!["reported", "pending_confirmation"].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
    }

    // Check if match is already finalized
    if (match.status === "finalized") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED);
    }

    // Create or update confirmation
    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: confirmedBy,
      isConfirmed: true,
      isContested: false,
    });

    // Check if match can be validated
    await this.checkAndFinalizeMatch(id);

    return await matchRepository.getById(id);
  }

  /**
   * Contest match result
   */
  async contestMatch(
    id: string,
    input: ContestMatchInput,
    contestedBy: string
  ) {
    const match = await this.getMatchById(id);

    // Check if user is participant in the match
    const isParticipant = await matchRepository.isUserInMatch(id, contestedBy);
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
    }

    // Check if match is in reported state
    if (!["reported", "pending_confirmation"].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
    }

    // Check if match is already finalized
    if (match.status === "finalized") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED);
    }

    // Create or update contestation
    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: contestedBy,
      isConfirmed: false,
      isContested: true,
      contestationReason: input.contestationReason,
      contestationProof: input.contestationProof,
    });

    // Update match status to disputed
    await matchRepository.update(id, {
      status: "disputed",
    });

    return await matchRepository.getById(id);
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
    await matchInputValidator.validateMatchInputForValidation(input, tournament, errors);
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
          errors.push(error instanceof Error ? error.message : fallbackMessage);
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

  /**
   * Check if match can be finalized and finalize it if conditions are met
   */
  private async checkAndFinalizeMatch(matchId: string) {
    const match = await matchRepository.getById(matchId);
    if (!match) return;

    // Don't auto-finalize if already finalized or disputed
    if (match.status === "finalized" || match.status === "disputed") {
      return;
    }

    // Get all participants
    const participants = await matchRepository.getParticipationsByMatchId(
      matchId
    );
    const totalPlayers = participants.length;

    if (totalPlayers === 0) return;

    // Get all confirmations
    const confirmations = await matchConfirmationRepository.getByMatchId(
      matchId
    );

    // Check if any player has contested
    const hasContestation = confirmations.some((c) => c.isContested);
    if (hasContestation) {
      // Match has contestation, set to disputed
      await matchRepository.update(matchId, {
        status: "disputed",
      });
      return;
    }

    // Count confirmed players
    const confirmedCount = confirmations.filter((c) => c.isConfirmed).length;

    // Check if more than 50% have confirmed
    const hasaMajority = confirmedCount > totalPlayers / 2;

    // Check if both teams have at least one confirmation
    const teamAParticipants = participants.filter((p) => p.teamSide === "A");
    const teamBParticipants = participants.filter((p) => p.teamSide === "B");

    const teamAConfirmed = confirmations.some(
      (c) =>
        c.isConfirmed &&
        teamAParticipants.some((p) => p.playerId === c.playerId)
    );
    const teamBConfirmed = confirmations.some(
      (c) =>
        c.isConfirmed &&
        teamBParticipants.some((p) => p.playerId === c.playerId)
    );

    const bothTeamsConfirmed = teamAConfirmed && teamBConfirmed;

    // If all conditions are met, finalize the match
    if (hasaMajority && bothTeamsConfirmed && !hasContestation) {
      await this.finalizeMatch(matchId, {
        finalizationReason: "consensus",
      });
    }
  }

  /**
   * Finalize a match
   */
  async finalizeMatch(
    id: string,
    input: FinalizeMatchInput,
    finalizedBy?: string
  ) {
    const match = await this.getMatchById(id);

    // Check if match is already finalized
    if (match.status === "finalized") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED);
    }

    // Update match status to finalized
    const updateData: UpdateMatchData = {
      status: "finalized",
      finalizedAt: new Date(),
      finalizationReason: input.finalizationReason,
    };

    if (finalizedBy) {
      updateData.finalizedBy = finalizedBy;
    }

    return await matchRepository.update(id, updateData);
  }

  /**
   * Auto-finalize matches after 72h deadline
   * Called by a cron job
   */
  async autoFinalizeExpiredMatches() {
    const now = new Date();

    // Get all matches that are reported/pending_confirmation and have expired deadline
    const expiredMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.status, "reported")
        // confirmationDeadline is in the past
      ),
    });

    const finalized: string[] = [];
    const disputed: string[] = [];

    for (const match of expiredMatches) {
      if (!match.confirmationDeadline) continue;
      if (new Date(match.confirmationDeadline) > now) continue;

      // Check if there are any contestations
      const hasContestation =
        await matchConfirmationRepository.hasAnyContestation(match.id);

      if (hasContestation) {
        // Keep as disputed
        disputed.push(match.id);
      } else {
        // Auto-finalize
        await this.finalizeMatch(match.id, {
          finalizationReason: "auto_validation",
        });
        finalized.push(match.id);
      }
    }

    return {
      finalized,
      disputed,
      total: finalized.length + disputed.length,
    };
  }

  /**
   * Send notification to all match participants except creator
   */
  private async notifyMatchCreated(
    matchId: string,
    createdBy: string,
    tournamentName: string
  ) {
    const match = await matchRepository.getById(matchId);
    if (!match) return;

    const participants = await matchRepository.getParticipationsByMatchId(
      matchId
    );

    const creator = await userRepository.getById(createdBy);
    const creatorName = creator?.displayName || 'Un joueur';

    const teamAParticipants = participants.filter((p) => p.teamSide === "A");
    const teamBParticipants = participants.filter((p) => p.teamSide === "B");

    const playerIds = [...new Set(participants.map((p) => p.playerId))].filter(
      (playerId) => playerId !== createdBy
    );

    const matchDate = match.playedAt
      ? new Date(match.playedAt).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
      : 'À définir';

    // Calculate match format (1v1, 2v2, etc.)
    const teamSize = teamAParticipants.length;
    const matchFormat = `${teamSize}v${teamSize}`;

    // Determine if match is scheduled (future) or reported (past/present)
    const isScheduled = match.status === 'scheduled' ||
      (match.playedAt && new Date(match.playedAt) > new Date());

    const titleKey = isScheduled
      ? "notifications.MATCH_SCHEDULED_TITLE"
      : "notifications.MATCH_CREATED_TITLE";
    const messageKey = isScheduled
      ? "notifications.MATCH_SCHEDULED_MESSAGE"
      : "notifications.MATCH_CREATED_MESSAGE";

    for (const playerId of playerIds) {
      const participant = participants.find((p) => p.playerId === playerId);
      if (!participant) continue;

      const isTeamA = participant.teamSide === "A";
      const teammates = isTeamA ? teamAParticipants : teamBParticipants;
      const opponents = isTeamA ? teamBParticipants : teamAParticipants;

      const teammateNames = await Promise.all(
        teammates
          .filter((p) => p.playerId !== playerId)
          .map(async (p) => {
            const user = await userRepository.getById(p.playerId);
            return user?.displayName || 'Joueur inconnu';
          })
      );

      const opponentNames = await Promise.all(
        opponents.map(async (p) => {
          const user = await userRepository.getById(p.playerId);
          return user?.displayName || 'Joueur inconnu';
        })
      );

      const teammatesText = teammateNames.length > 0
        ? teammateNames.join(', ')
        : 'Aucun';
      const opponentsText = opponentNames.join(', ');

      await notificationService.send({
        userId: playerId,
        type: "match_created",
        titleKey,
        messageKey,
        translationParams: {
          creatorName,
          tournamentName,
          matchFormat,
          round: match.round?.toString() || '1',
          matchDate,
          opponents: opponentsText,
          teammates: teammatesText
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: false,
      });
    }
  }
}

export const matchService = new MatchService();
