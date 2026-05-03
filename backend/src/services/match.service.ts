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
  type ListMatchCardsQuery,
  type ClientMatchCard,
  type PaginatedMatchCards,
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
import { matchSidesRepository } from "../repository/match-sides.repository";
import { notificationService } from "./notification.service";
import { matchInputValidator } from "./validators/match-input.validator";
import { logger } from "../utils/logger";
import { matchRuleValidator } from "./validators/match-rule.validator";
import { matchPermissionValidator } from "./validators/match-permission.validator";
import { matchStatusValidator } from "./validators/match-status.validator";
import { bracketService } from "./bracket.service";
import { mmrCalculationService } from "./mmr-calculation.service";
import { standingsService } from "./standings.service";
import { playerComputedDataRepository } from "../repository/player-computed-data.repository";
import { participantRepository } from "../repository/participant.repository";
import { tournamentStatsRepository } from "../repository/tournament-stats.repository";
import { rankedSeasonRepository } from "../repository/ranked-season.repository";
import { rankedSeasonService } from "./ranked-season.service";
import { mmrAnimationEventService } from "./mmr-animation-event.service";
import { teamRepository } from "../repository/team.repository";

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

    if (tournament.mode === "ranked") {
      matchInputValidator.validateRankedPlayedAt(input.playedAt);
      await this.autoRegisterRankedPlayers(input);
    }

    if (!tournament.scoreEnabled && input.status === "reported") {
      matchInputValidator.validateWinnerRequired(input.winner);
      input.scoreA = null;
      input.scoreB = null;
    } else if (input.status === "reported" && input.scoreA != null && input.scoreB != null) {
      matchInputValidator.validateScores(input.scoreA, input.scoreB);
      matchInputValidator.validateScoreRange(input.scoreA, input.scoreB, tournament.minScore, tournament.maxScore);
      await matchInputValidator.validateDrawAllowed(input.tournamentId, input.scoreA, input.scoreB, input.winner);
    }

    if (input.playedAt) {
      const playerIds = await this.resolvePlayerIds(input, tournament);
      await this.validateNoPlayerConflict(playerIds, input.playedAt, input.tournamentId);
    }

    const matchId = await this.createMatchRecord(input, createdBy);

    // If match is reported, create automatic confirmation for the creator
    // Skip for kiosk users: they are not real participants, their confirmation wouldn't count
    if (input.status === "reported") {
      const creator = await userRepository.getById(createdBy);
      if (creator?.role !== "kiosk") {
        await matchConfirmationRepository.upsert({
          matchId,
          playerId: createdBy,
          isConfirmed: true,
          isContested: false,
        });
      }

      // Check if match can be validated immediately
      await this.checkAndFinalizeMatch(matchId);
      // Recalculate per-player standings points for flex championships (backdated match support)
      await this.triggerStandingsRecalcIfNeeded(input.tournamentId, matchId);

      const refreshed = await matchRepository.getById(matchId);
      if (refreshed?.status === "reported") {
        // Single rich action notification — replaces the informational MATCH_CREATED
        await this.notifyMatchValidationRequired(matchId, createdBy);
        this.recomputeProvisionalIfRanked(input.tournamentId).catch(() => {});
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
  /**
   * Auto-register ranked season players so they can participate in matches
   */
  /**
   * Trigger standings recalculation for flex championships with match limits.
   * Called after match creation (reported) or finalization.
   * Always invalidates standings cache; also rebuilds player points for flex tournaments.
   */
  private async triggerStandingsRecalcIfNeeded(tournamentId: string, matchId?: string): Promise<void> {
    const tournament = await matchRepository.getTournament(tournamentId);
    if (tournament?.mode === "championship") {
      if (tournament.teamMode === "flex" && tournament.maxMatchesPerPlayer) {
        await standingsService.recalculatePointsInternal(tournamentId);
      } else {
        await standingsService.invalidateCache(tournamentId);
      }
    }
    if (matchId) {
      const playerIds = await matchRepository.getPlayerIdsForMatch(matchId);
      if (playerIds.length > 0) {
        await playerComputedDataRepository.deleteMany(playerIds);
      }
    }
  }

  private async autoRegisterRankedPlayers(input: CreateMatchInput): Promise<void> {
    const allPlayerIds = [
      ...(input.playerIdsA ?? []),
      ...(input.playerIdsB ?? []),
    ];
    for (const playerId of allPlayerIds) {
      const existing = await participantRepository.findParticipationByUserAndTournament(
        playerId,
        input.tournamentId,
      );
      if (!existing) {
        await participantRepository.createParticipation(playerId, input.tournamentId);
      }
    }
  }

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
      createdBy,
      playedAt: input.playedAt ? new Date(input.playedAt) : undefined,
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
      else if (input.winner === undefined && input.scoreA != null && input.scoreB != null) {
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
   * Lean paginated match list for the unified GET /matches endpoint.
   */
  async listMatchCards(filters: ListMatchCardsQuery): Promise<PaginatedMatchCards> {
    const { data: rows, total } = await matchRepository.listMatchCards(filters);
    if (rows.length === 0) return { data: [], total: 0, hasMore: false };

    const matchIds = rows.map((r) => r.matchId);
    const sidesData = await matchSidesRepository.getByMatchIds(matchIds);

    const sidesByMatch = new Map<string, typeof sidesData>();
    for (const side of sidesData) {
      if (!sidesByMatch.has(side.matchId)) sidesByMatch.set(side.matchId, []);
      sidesByMatch.get(side.matchId)!.push(side);
    }

    const data: ClientMatchCard[] = rows.map((row) => ({
      id: row.matchId,
      playedAt: row.playedAt ?? new Date(),
      status: row.status,
      tournament: {
        id: row.tournamentId,
        name: row.tournamentName,
        mode: row.tournamentMode,
        scoreEnabled: row.tournamentScoreEnabled,
      },
      sides: (sidesByMatch.get(row.matchId) ?? []).map((s) => ({
        position: s.position,
        score: s.score,
        isWinner: row.winnerSide === (s.position === 1 ? "A" : "B"),
        players: s.entry.players.map((p) => ({
          id: p.player.id,
          displayName: p.player.displayName,
          shortName: p.player.shortName ?? p.player.displayName.slice(0, 8),
        })),
      })),
      outcomeType: row.outcomeTypeId
        ? { id: row.outcomeTypeId, name: row.outcomeTypeName ?? "" }
        : null,
      ...(filters.playerIds && {
        playerId: filters.playerIds.split(',')[0],
        mmrDelta: row.mmrDelta ?? null,
        pointsDelta: row.pointsDelta ?? null,
      }),
    }));

    return {
      data,
      total,
      hasMore: filters.offset + filters.limit < total,
    };
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
    if (input.playedAt !== undefined) {
      updateData.playedAt = new Date(input.playedAt);
      const playerIds = await matchRepository.getPlayerIdsForMatch(id);
      await this.validateNoPlayerConflict(playerIds, input.playedAt, match.tournamentId, id);
    }

    if (input.status === "reported") {
      const scoreA = input.scoreA ?? 0;
      const scoreB = input.scoreB ?? 0;
      matchInputValidator.validateScores(scoreA, scoreB);
      matchInputValidator.validateScoreRange(scoreA, scoreB, tournament?.minScore, tournament?.maxScore);
      await matchInputValidator.validateDrawAllowed(match.tournamentId, scoreA, scoreB, input.winner);

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
    await this.validateScoreConstraints(match.tournamentId, input);

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

    if (refreshed?.status === "reported" || refreshed?.status === "pending_confirmation") {
      this.recomputeProvisionalIfRanked(match.tournamentId).catch(() => {});
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
   * Validate all score constraints: non-negative, range, draw allowed
   */
  private async validateScoreConstraints(
    tournamentId: string,
    input: ReportMatchResultInput,
  ) {
    matchInputValidator.validateScores(input.scoreA, input.scoreB);
    const tournament = await matchRepository.getTournament(tournamentId);
    matchInputValidator.validateScoreRange(
      input.scoreA,
      input.scoreB,
      tournament?.minScore,
      tournament?.maxScore,
    );
    await matchInputValidator.validateDrawAllowed(
      tournamentId,
      input.scoreA,
      input.scoreB,
      input.winner,
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

    // Kiosk users cannot confirm match results
    const confirmer = await userRepository.getById(confirmedBy);
    if (confirmer?.role === "kiosk") {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

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

    // Kiosk users cannot contest match results
    const contester = await userRepository.getById(contestedBy);
    if (contester?.role === "kiosk") {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

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

      this.recomputeProvisionalIfRanked(match.tournamentId).catch(() => {});

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

      this.recomputeProvisionalIfRanked(match.tournamentId).catch(() => {});
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
      if (input.playedAt) {
        const playerIds = await this.resolvePlayerIds(input, tournament);
        const conflict = await matchRepository.findPlayerConflictAtTime(
          playerIds,
          new Date(input.playedAt),
          input.tournamentId,
          input.matchId,
        );
        if (conflict) {
          errors.push(
            `${conflict.playerName} a déjà un match à cette date et heure`,
          );
        }
      }
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
      logger.error({ err: error }, "Error checking for duplicate matches");
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

    const canceller = await userRepository.getById(cancelledBy);
    if (canceller?.role === "kiosk") {
      // Kiosk can only cancel matches they personally created
      if (match.createdBy !== cancelledBy) {
        throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
      }
    } else {
      const isAdmin = await this.canManageMatches(match.tournamentId, cancelledBy);
      const isParticipant = await matchRepository.isUserInMatch(id, cancelledBy);
      if (!isAdmin && !isParticipant) {
        throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
      }
    }

    matchStatusValidator.validateCanCancel(match.status);

    const wasUnfinalized = ['reported', 'pending_confirmation', 'disputed'].includes(match.status);
    await matchRepository.update(id, { status: "cancelled" });
    await notificationService.deleteActionsByMatchId(id);
    if (wasUnfinalized) {
      this.recomputeProvisionalIfRanked(match.tournamentId).catch(() => {});
    }

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
    // Process MMR calculation for ranked seasons
    await mmrCalculationService.processMatchFinalization(id);
    // Create official MMR animation events and broadcast to players
    mmrAnimationEventService
      .createOfficialEventsAndBroadcast(id, match.tournamentId)
      .catch((err) => logger.error({ err }, "[MmrAnimation] official event failed"));
    // Recompute official + provisional leaderboard cache for ranked
    const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(match.tournamentId);
    if (rankedConfig) {
      rankedSeasonService.computeAndCacheOfficial(match.tournamentId).catch(() => {});
      rankedSeasonService.computeAndCacheProvisional(match.tournamentId).catch(() => {});
    }
    // Recalculate per-player standings points for flex championships
    await this.triggerStandingsRecalcIfNeeded(match.tournamentId, id);
    // Invalidate stats cache so next fetch recomputes with the new finalized match
    await tournamentStatsRepository.deleteComputedStats(match.tournamentId);
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

  private async recomputeProvisionalIfRanked(tournamentId: string): Promise<void> {
    const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId);
    if (rankedConfig) {
      rankedSeasonService.computeAndCacheProvisional(tournamentId).catch(() => {});
    }
  }

  private async resolvePlayerIds(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
  ): Promise<string[]> {
    if (tournament.teamMode === "flex") {
      return [...(input.playerIdsA ?? []), ...(input.playerIdsB ?? [])];
    }
    const ids: string[] = [];
    if (input.teamAId) {
      const teamA = await teamRepository.getById(input.teamAId);
      if (teamA) ids.push(...teamA.members.map((m) => m.userId));
    }
    if (input.teamBId) {
      const teamB = await teamRepository.getById(input.teamBId);
      if (teamB) ids.push(...teamB.members.map((m) => m.userId));
    }
    return ids;
  }

  private async validateNoPlayerConflict(
    playerIds: string[],
    playedAt: Date | string,
    tournamentId: string,
    excludeMatchId?: string,
  ): Promise<void> {
    if (playerIds.length === 0) return;
    const conflict = await matchRepository.findPlayerConflictAtTime(
      playerIds,
      new Date(playedAt),
      tournamentId,
      excludeMatchId,
    );
    if (conflict) {
      throw new ConflictError(ErrorCode.PLAYER_SCHEDULE_CONFLICT, {
        playerName: conflict.playerName,
      });
    }
  }
}

export const matchService = new MatchService();
