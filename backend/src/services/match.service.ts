import { matchRepository } from "../repository/match.repository";
import { matchConfirmationRepository } from "../repository/match-confirmation.repository";
import { userRepository } from "../repository/user.repository";
import { entryRepository } from "../repository/entry.repository";
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
import { bracketService } from "./bracket.service";

type TournamentFromRepository = Awaited<
  ReturnType<typeof matchRepository.getTournament>
>;

export class MatchService {
  /**
   * Check if user can manage matches in tournament
   */
  async canManageMatches(
    tournamentId: string,
    userId: string,
  ): Promise<boolean> {
    return await matchPermissionValidator.canManageMatches(
      tournamentId,
      userId,
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

    const matchId = await this.createMatchRecord(input, createdBy);

    // If match is reported, create automatic confirmation for the creator
    if (input.status === "reported") {
      await matchConfirmationRepository.upsert({
        matchId,
        playerId: createdBy,
        isConfirmed: true,
        isContested: false,
      });

      // Check if match can be validated immediately
      await this.checkAndFinalizeMatch(matchId);

      const refreshed = await matchRepository.getById(matchId);
      if (refreshed?.status === "reported") {
        // Single rich action notification — replaces the informational MATCH_CREATED
        await this.notifyMatchValidationRequired(matchId, createdBy);
      } else {
        // Immediately finalized (e.g. solo match) — just inform participants
        await this.notifyMatchCreated(matchId, createdBy, tournament.name);
      }

      return await matchRepository.getById(matchId);
    }

    await this.notifyMatchCreated(matchId, createdBy, tournament.name);

    return await matchRepository.getById(matchId);
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
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    await matchPermissionValidator.checkCreatePermissions(
      input,
      createdBy,
      tournament,
    );
  }

  /**
   * Validate match input based on team mode
   */
  private async validateMatchInput(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    await matchInputValidator.validateMatchInput(input, tournament);
  }

  /**
   * Create match record in database
   */
  private async createMatchRecord(input: CreateMatchInput, createdBy: string) {
    const matchData: any = {
      tournamentId: input.tournamentId,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      playerIdsA: input.playerIdsA,
      playerIdsB: input.playerIdsB,
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

      // Calculate confirmation deadline (72 hours from now)
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + 72);
      matchData.confirmationDeadline = confirmationDeadline;

      // Determine winner
      // Priority 1: Use explicit winner selection from user (handles forfeit, abandon, etc.)
      if (input.winner) {
        matchData.winner = input.winner;
      }
      // Priority 2: If no explicit winner but winner is explicitly null (draw)
      else if (input.winner === null) {
        matchData.winner = null;
      }
      // Priority 3: Fall back to score-based calculation (if winner field was not provided)
      else if (input.winner === undefined) {
        if (input.scoreA > input.scoreB) {
          matchData.winner = "teamA";
        } else if (input.scoreB > input.scoreA) {
          matchData.winner = "teamB";
        } else {
          // If scores are equal, it's a draw
          matchData.winner = null;
        }
      }
    }

    return await matchRepository.create(matchData);
  }

  /**
   * Validate match rules against tournament settings
   */
  private async validateMatchRules(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>,
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
    playerId?: string;
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
      updatedBy,
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Can only update certain fields based on status
    if (match.status === "confirmed") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_CONFIRMED);
    }

    // Bracket matches require both teams to be assigned before any update
    const tournament = await matchRepository.getTournament(match.tournamentId);
    if (tournament?.mode === "bracket") {
      const sides = (match as { sides?: { entryId: string }[] }).sides ?? [];
      if (sides.length < 2) {
        throw new BadRequestError(ErrorCode.BRACKET_MATCH_TEAMS_NOT_READY);
      }
    }

    const updateData: UpdateMatchData = {};
    if (input.scoreA !== undefined) updateData.scoreA = input.scoreA;
    if (input.scoreB !== undefined) updateData.scoreB = input.scoreB;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.reportProof !== undefined)
      updateData.reportProof = input.reportProof;
    if (input.outcomeTypeId !== undefined)
      updateData.outcomeTypeId = input.outcomeTypeId;
    if (input.outcomeReasonId !== undefined)
      updateData.outcomeReasonId = input.outcomeReasonId;
    if (input.winner !== undefined) updateData.winner = input.winner;

    if (input.status === "reported") {
      updateData.reportedBy = updatedBy;
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + 72);
      updateData.confirmationDeadline = confirmationDeadline;
    }

    const result = await matchRepository.update(id, updateData);
    // Admin update may resolve a pending score dispute — delete blocking action notifications
    await notificationService.deleteActionsByMatchId(id);
    if (input.status === "reported") {
      await this.notifyMatchValidationRequired(id, updatedBy);
    }
    return result;
  }

  /**
   * Delete match
   */
  async deleteMatch(id: string, deletedBy: string) {
    const match = await this.getMatchById(id);

    // Check permissions
    const canManage = await this.canManageMatches(
      match.tournamentId,
      deletedBy,
    );
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Can only delete if not confirmed
    if (match.status === "confirmed") {
      throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_DELETED);
    }

    // Delete match (cascade will handle match_sides and match_results)
    await matchRepository.delete(id);

    return { success: true, message: "Match supprimé avec succès" };
  }

  /**
   * Report match result
   */
  async reportMatchResult(
    id: string,
    input: ReportMatchResultInput,
    reportedBy: string,
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

    // Only notify other participants if match still needs validation
    const refreshed = await matchRepository.getById(id);
    if (refreshed?.status === "reported") {
      await this.notifyMatchValidationRequired(id, reportedBy);
    }

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
    input: ReportMatchResultInput,
  ) {
    await matchInputValidator.validateDrawAllowed(
      tournamentId,
      input.scoreA,
      input.scoreB,
    );
  }

  /**
   * Build update data for match result report
   */
  private buildReportUpdateData(
    input: ReportMatchResultInput,
    match: Awaited<ReturnType<typeof matchRepository.getById>>,
    reportedBy: string,
  ): UpdateMatchData {
    const updateData: UpdateMatchData = {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      status: "reported",
      reportProof: input.reportProof,
      outcomeTypeId: input.outcomeTypeId,
      outcomeReasonId: input.outcomeReasonId,
    };

    // Pass explicit winner if provided, otherwise derive from scores
    if (input.winner !== undefined) {
      updateData.winner = input.winner;
    } else if (input.scoreA > input.scoreB) {
      updateData.winner = "teamA";
    } else if (input.scoreB > input.scoreA) {
      updateData.winner = "teamB";
    } else {
      updateData.winner = null;
    }

    return updateData;
  }

  /**
   * Confirm match result
   */
  async confirmMatch(
    id: string,
    input: ConfirmMatchInput,
    confirmedBy: string,
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

    // Auto-dismiss action notification for this user (they've acted)
    await notificationService.deleteActionsByMatchIdForUser(id, confirmedBy);

    // Check if match can be validated
    await this.checkAndFinalizeMatch(id);

    return await matchRepository.getById(id);
  }

  /**
   * Contest match result.
   * If proposedScoreA + proposedScoreB are provided, creates a score proposal:
   *  - resets other players' confirmations
   *  - sets match to pending_confirmation
   *  - notifies all participants
   * Otherwise (simple contestation), sets match to disputed (legacy behaviour).
   */
  async contestMatch(
    id: string,
    input: ContestMatchInput,
    contestedBy: string,
  ) {
    const match = await this.getMatchById(id);

    // Check if user is participant in the match
    const isParticipant = await matchRepository.isUserInMatch(id, contestedBy);
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
    }

    // Check if match is in reported / pending_confirmation state
    if (!["reported", "pending_confirmation"].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
    }

    // Check if match is already finalized
    if (match.status === "finalized") {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED);
    }

    const hasScoreProposal =
      input.proposedScoreA !== undefined && input.proposedScoreB !== undefined;

    // Upsert the contesting player's confirmation
    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: contestedBy,
      isConfirmed: false,
      isContested: true,
      contestationReason: input.contestationReason,
      contestationProof: input.contestationProof,
      proposedScoreA: hasScoreProposal ? input.proposedScoreA : null,
      proposedScoreB: hasScoreProposal ? input.proposedScoreB : null,
      proposedWinner: hasScoreProposal ? (input.proposedWinner ?? null) : null,
      proposedOutcomeTypeId: hasScoreProposal
        ? (input.proposedOutcomeTypeId ?? null)
        : null,
      proposedOutcomeReasonId: hasScoreProposal
        ? (input.proposedOutcomeReasonId ?? null)
        : null,
    });

    if (hasScoreProposal) {
      // Auto-dismiss action notification for the contesting user (they've acted)
      await notificationService.deleteActionsByMatchIdForUser(id, contestedBy);

      // Reset all other players' confirmations so they review the new proposal
      await matchConfirmationRepository.resetConfirmationsExcept(
        id,
        contestedBy,
      );

      // Extend the confirmation deadline by 72h from now
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + 72);

      // Move to pending_confirmation
      await matchRepository.update(id, {
        status: "pending_confirmation",
        confirmationDeadline,
      });

      // Notify all other participants about the score proposal
      await this.notifyScoreProposal(
        id,
        contestedBy,
        input.proposedScoreA!,
        input.proposedScoreB!,
      );
    } else {
      // Simple contestation — mark as disputed (legacy)
      await matchRepository.update(id, {
        status: "disputed",
      });
    }

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
          "Le tournoi doit être ouvert ou en cours pour créer des matchs",
        );
        return { valid: false, errors, warnings };
      }

      await this.validateMatchInputForValidation(input, tournament, errors);
      await this.validateTournamentRulesForValidation(
        input,
        tournament,
        errors,
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
          : "Erreur inattendue lors de la validation",
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
    tournament: TournamentFromRepository,
  ): boolean {
    return tournament ? ["open", "ongoing"].includes(tournament.status) : false;
  }

  /**
   * Validate match input based on team mode
   */
  private async validateMatchInputForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[],
  ) {
    await matchInputValidator.validateMatchInputForValidation(
      input,
      tournament,
      errors,
    );
  }

  /**
   * Validate tournament rules for validation
   */
  private async validateTournamentRulesForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[],
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
            i18next.t(`errors.${error.code}`, error.details || {}),
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
    excludeMatchId?: string,
  ) {
    // Get or determine entry IDs based on team mode
    let entryAId: string | undefined;
    let entryBId: string | undefined;

    try {
      if (input.teamAId && input.teamBId) {
        // Static mode: find entries by teamId (don't create)
        const entryA = await entryRepository.findExistingEntry(
          input.tournamentId,
          input.teamAId,
          undefined,
        );
        const entryB = await entryRepository.findExistingEntry(
          input.tournamentId,
          input.teamBId,
          undefined,
        );
        entryAId = entryA?.id;
        entryBId = entryB?.id;
      } else if (input.playerIdsA && input.playerIdsB) {
        // Flex mode: find entries by playerIds (don't create)
        const entryA = await entryRepository.findExistingEntry(
          input.tournamentId,
          undefined,
          input.playerIdsA,
        );
        const entryB = await entryRepository.findExistingEntry(
          input.tournamentId,
          undefined,
          input.playerIdsB,
        );
        entryAId = entryA?.id;
        entryBId = entryB?.id;
      }

      if (!entryAId || !entryBId) return;

      // Find matches with the same entries
      const duplicates = await matchRepository.findMatchesWithSameEntries(
        input.tournamentId,
        entryAId,
        entryBId,
        excludeMatchId,
      );

      if (duplicates.length > 0) {
        warnings.push("Un match similaire existe déjà");
      }
    } catch (error) {
      // Don't fail the validation if duplicate check fails
      // Just log the error and continue
      console.error("Error checking for duplicate matches:", error);
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

    // Only process reported and pending_confirmation statuses
    if (!["reported", "pending_confirmation"].includes(match.status)) {
      return;
    }

    // Get all participants
    const participants =
      await matchRepository.getParticipationsByMatchId(matchId);
    const totalPlayers = participants.length;

    if (totalPlayers === 0) return;

    // Get all confirmations
    const confirmations =
      await matchConfirmationRepository.getByMatchId(matchId);

    // Check if any player has contested (without a score proposal — simple dispute)
    const hasSimpleContestation = confirmations.some(
      (c) =>
        c.isContested &&
        (c.proposedScoreA === null || c.proposedScoreA === undefined),
    );
    if (hasSimpleContestation) {
      await matchRepository.update(matchId, {
        status: "disputed",
      });
      return;
    }

    // In pending_confirmation mode the proposer's submission IS their vote.
    // Treat them as confirmed so majority/team checks work correctly.
    const activeProposal =
      await matchConfirmationRepository.getActiveProposal(matchId);
    const proposerPlayerId =
      match.status === "pending_confirmation"
        ? activeProposal?.playerId
        : undefined;

    const effectiveConfirmations = confirmations.map((c) =>
      c.playerId === proposerPlayerId ? { ...c, isConfirmed: true } : c,
    );

    // Count confirmed players
    const confirmedCount = effectiveConfirmations.filter(
      (c) => c.isConfirmed,
    ).length;

    // Check if more than 50% have confirmed
    const hasaMajority = confirmedCount > totalPlayers / 2;

    // Check if both teams have at least one confirmation
    const teamAParticipants = participants.filter((p) => p.teamSide === "A");
    const teamBParticipants = participants.filter((p) => p.teamSide === "B");

    const teamAConfirmed = effectiveConfirmations.some(
      (c) =>
        c.isConfirmed &&
        teamAParticipants.some((p) => p.playerId === c.playerId),
    );
    const teamBConfirmed = effectiveConfirmations.some(
      (c) =>
        c.isConfirmed &&
        teamBParticipants.some((p) => p.playerId === c.playerId),
    );

    const bothTeamsConfirmed = teamAConfirmed && teamBConfirmed;

    // If all conditions are met, finalize the match
    if (hasaMajority && bothTeamsConfirmed) {
      // If there's an active score proposal, apply those scores before finalizing
      if (
        activeProposal &&
        activeProposal.proposedScoreA !== null &&
        activeProposal.proposedScoreA !== undefined &&
        activeProposal.proposedScoreB !== null &&
        activeProposal.proposedScoreB !== undefined
      ) {
        const updateData: UpdateMatchData = {
          scoreA: activeProposal.proposedScoreA,
          scoreB: activeProposal.proposedScoreB,
        };

        // Apply proposed winner if provided
        if (
          activeProposal.proposedWinner !== null &&
          activeProposal.proposedWinner !== undefined
        ) {
          updateData.winner = activeProposal.proposedWinner as
            | "teamA"
            | "teamB"
            | null;
        }

        // Apply proposed outcome type/reason if provided
        if (
          activeProposal.proposedOutcomeTypeId !== null &&
          activeProposal.proposedOutcomeTypeId !== undefined
        ) {
          updateData.outcomeTypeId = activeProposal.proposedOutcomeTypeId;
        }
        if (
          activeProposal.proposedOutcomeReasonId !== null &&
          activeProposal.proposedOutcomeReasonId !== undefined
        ) {
          updateData.outcomeReasonId = activeProposal.proposedOutcomeReasonId;
        }

        await matchRepository.update(matchId, updateData);
      }

      await this.finalizeMatch(matchId, {
        finalizationReason: "consensus",
      });
    }
  }

  /**
   * Cancel a match (admin or participant only, not finalized/cancelled)
   */
  async cancelMatch(id: string, cancelledBy: string) {
    const match = await this.getMatchById(id);

    const isAdmin = await this.canManageMatches(match.tournamentId, cancelledBy);
    const isParticipant = await matchRepository.isUserInMatch(id, cancelledBy);

    if (!isAdmin && !isParticipant) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    matchStatusValidator.validateCanCancel(match.status);

    await matchRepository.update(id, { status: "cancelled" });
    await notificationService.deleteActionsByMatchId(id);

    return await matchRepository.getById(id);
  }

  /**
   * Finalize a match
   */
  async finalizeMatch(
    id: string,
    input: FinalizeMatchInput,
    finalizedBy?: string,
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

    const result = await matchRepository.update(id, updateData);
    // Auto-delete any pending MATCH_SCORE_PROPOSAL action notifications for this match
    await notificationService.deleteActionsByMatchId(id);
    // Advance winner and loser to next bracket rounds if applicable
    await bracketService.advanceWinnerToNextRound(id);
    await bracketService.advanceLoserToNextRound(id);
    return result;
  }

  /**
   * Auto-finalize matches after 72h deadline
   * Called by a cron job
   */
  async autoFinalizeExpiredMatches() {
    const now = new Date();

    // Get all matches that are reported or pending_confirmation and have an expired deadline
    const expiredMatches =
      await matchRepository.getMatchesPendingFinalization();

    const finalized: string[] = [];
    const disputed: string[] = [];

    for (const match of expiredMatches) {
      if (!match.confirmationDeadline) continue;
      if (new Date(match.confirmationDeadline) > now) continue;

      // Check if there are any simple contestations (no score proposal)
      const confirmations = await matchConfirmationRepository.getByMatchId(
        match.id,
      );
      const hasSimpleContestation = confirmations.some(
        (c) =>
          c.isContested &&
          (c.proposedScoreA === null || c.proposedScoreA === undefined),
      );

      if (hasSimpleContestation) {
        // Keep as disputed
        disputed.push(match.id);
      } else {
        // Apply active score proposal if any, then auto-finalize
        const activeProposal =
          await matchConfirmationRepository.getActiveProposal(match.id);
        if (
          activeProposal &&
          activeProposal.proposedScoreA !== null &&
          activeProposal.proposedScoreA !== undefined &&
          activeProposal.proposedScoreB !== null &&
          activeProposal.proposedScoreB !== undefined
        ) {
          const updateData: UpdateMatchData = {
            scoreA: activeProposal.proposedScoreA,
            scoreB: activeProposal.proposedScoreB,
          };

          // Apply proposed winner if provided
          if (
            activeProposal.proposedWinner !== null &&
            activeProposal.proposedWinner !== undefined
          ) {
            updateData.winner = activeProposal.proposedWinner as
              | "teamA"
              | "teamB"
              | null;
          }

          // Apply proposed outcome type/reason if provided
          if (
            activeProposal.proposedOutcomeTypeId !== null &&
            activeProposal.proposedOutcomeTypeId !== undefined
          ) {
            updateData.outcomeTypeId = activeProposal.proposedOutcomeTypeId;
          }
          if (
            activeProposal.proposedOutcomeReasonId !== null &&
            activeProposal.proposedOutcomeReasonId !== undefined
          ) {
            updateData.outcomeReasonId = activeProposal.proposedOutcomeReasonId;
          }

          await matchRepository.update(match.id, updateData);
        }

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
    tournamentName: string,
  ) {
    const match = await matchRepository.getById(matchId);
    if (!match) return;

    const participants =
      await matchRepository.getParticipationsByMatchId(matchId);

    const creator = await userRepository.getById(createdBy);
    const creatorName = creator?.displayName || "Un joueur";

    const teamAParticipants = participants.filter((p) => p.teamSide === "A");
    const teamBParticipants = participants.filter((p) => p.teamSide === "B");

    const playerIds = [...new Set(participants.map((p) => p.playerId))].filter(
      (playerId) => playerId !== createdBy,
    );

    const matchDate = match.playedAt
      ? new Date(match.playedAt).toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "À définir";

    // Calculate match format (1v1, 2v2, etc.)
    const teamSize = teamAParticipants.length;
    const matchFormat = `${teamSize}v${teamSize}`;

    // Determine if match is scheduled (future) or reported (past/present)
    const isScheduled =
      match.status === "scheduled" ||
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
            return user?.displayName || "Joueur inconnu";
          }),
      );

      const opponentNames = await Promise.all(
        opponents.map(async (p) => {
          const user = await userRepository.getById(p.playerId);
          return user?.displayName || "Joueur inconnu";
        }),
      );

      const teammatesText =
        teammateNames.length > 0 ? teammateNames.join(", ") : "Aucun";
      const opponentsText = opponentNames.join(", ");

      await notificationService.send({
        userId: playerId,
        type: "match_created",
        titleKey,
        messageKey,
        translationParams: {
          creatorName,
          tournamentName,
          matchFormat,
          matchDate,
          opponents: opponentsText,
          teammates: teammatesText,
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: false,
      });
    }
  }
  /**
   * Notify all match participants (except the reporter) that validation is required,
   * with rich match details (same info as MATCH_CREATED but as an action notification)
   */
  private async notifyMatchValidationRequired(
    matchId: string,
    reportedBy: string,
  ) {
    const match = await matchRepository.getById(matchId);
    if (!match) return;

    const tournament = await matchRepository.getTournament(match.tournamentId);
    const participants =
      await matchRepository.getParticipationsByMatchId(matchId);
    const reporter = await userRepository.getById(reportedBy);
    const reporterName = reporter?.displayName || "Un joueur";

    const teamAParticipants = participants.filter((p) => p.teamSide === "A");
    const teamBParticipants = participants.filter((p) => p.teamSide === "B");

    const matchDate = match.playedAt
      ? new Date(match.playedAt).toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "À définir";
    const matchFormat = `${teamAParticipants.length}v${teamAParticipants.length}`;

    const playerIds = [...new Set(participants.map((p) => p.playerId))].filter(
      (id) => id !== reportedBy,
    );

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
            return user?.displayName || "Joueur inconnu";
          }),
      );

      const opponentNames = await Promise.all(
        opponents.map(async (p) => {
          const user = await userRepository.getById(p.playerId);
          return user?.displayName || "Joueur inconnu";
        }),
      );

      await notificationService.send({
        userId: playerId,
        type: "MATCH_VALIDATION",
        titleKey: "notifications.MATCH_VALIDATION_TITLE",
        messageKey: "notifications.MATCH_VALIDATION_MESSAGE",
        translationParams: {
          reporterName,
          tournamentName: tournament?.name ?? "",
          matchFormat,
          matchDate,
          opponents: opponentNames.join(", "),
          teammates:
            teammateNames.length > 0 ? teammateNames.join(", ") : "Aucun",
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: true,
        matchId,
      });
    }
  }

  /**
   * Notify all match participants (except the proposer) about a new score proposal
   */
  private async notifyScoreProposal(
    matchId: string,
    proposedBy: string,
    proposedScoreA: number,
    proposedScoreB: number,
  ) {
    const match = await matchRepository.getById(matchId);
    if (!match) return;

    const participants =
      await matchRepository.getParticipationsByMatchId(matchId);
    const proposer = await userRepository.getById(proposedBy);
    const proposerName = proposer?.displayName || "Un joueur";

    const playerIds = [...new Set(participants.map((p) => p.playerId))].filter(
      (playerId) => playerId !== proposedBy,
    );

    for (const playerId of playerIds) {
      await notificationService.send({
        userId: playerId,
        type: "MATCH_SCORE_PROPOSAL",
        titleKey: "notifications.MATCH_SCORE_PROPOSAL_TITLE",
        messageKey: "notifications.MATCH_SCORE_PROPOSAL_MESSAGE",
        translationParams: {
          proposerName,
          scoreA: String(proposedScoreA),
          scoreB: String(proposedScoreB),
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: true,
        matchId,
      });
    }
  }
}

export const matchService = new MatchService();
