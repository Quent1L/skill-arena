import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { participantRepository } from "../repository/participant.repository";
import {
  type CreateTournamentInput,
  type UpdateTournamentInput,
  type TournamentMode,
  type TournamentStatus,
  type JoinTournamentRequest,
} from "@skill-arena/shared/types/index";
import {
  ErrorCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from "../types/errors";

export class TournamentService {
  /**
   * Check if user can manage tournament (owner, co_admin, or super_admin)
   */
  async canManageTournament(
    tournamentId: string,
    userId: string
  ): Promise<boolean> {
    const user = await userRepository.getById(userId);

    if (!user) return false;
    if (user.role === "super_admin") return true;

    // Check if user is tournament admin (owner or co_admin)
    return await tournamentRepository.isUserTournamentAdmin(
      tournamentId,
      userId
    );
  }

  /**
   * Check if user can create tournaments
   */
  async canCreateTournament(userId: string): Promise<boolean> {
    const user = await userRepository.getById(userId);

    if (!user) return false;
    return user.role === "tournament_admin" || user.role === "super_admin";
  }

  /**
   * Count draft tournaments for a user
   */
  async countDraftTournaments(userId: string): Promise<number> {
    return await tournamentRepository.countByUserAndStatus(userId, "draft");
  }

  /**
   * Create a new tournament
   */
  async createTournament(input: CreateTournamentInput) {
    await this.validateCreatePermissions(input.createdBy);
    await this.validateDraftLimit(input.createdBy);
    this.validateCreateInput(input);

    const tournament = await this.createTournamentRecord(input);
    await this.addCreatorAsOwner(tournament.id, input.createdBy);

    return tournament;
  }

  /**
   * Validate user can create tournament
   */
  private async validateCreatePermissions(userId: string) {
    const canCreate = await this.canCreateTournament(userId);
    if (!canCreate) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }
  }

  /**
   * Validate draft limit (max 5)
   */
  private async validateDraftLimit(userId: string) {
    const draftCount = await this.countDraftTournaments(userId);
    if (draftCount >= 5) {
      throw new ConflictError(ErrorCode.MAX_DRAFT_TOURNAMENTS_EXCEEDED, {
        max: 5,
        current: draftCount,
      });
    }
  }

  /**
   * Validate create tournament input
   */
  private validateCreateInput(input: CreateTournamentInput) {
    this.validateDateRange(input.startDate, input.endDate);
    this.validateTeamSize(input.minTeamSize, input.maxTeamSize);
  }

  /**
   * Validate date range
   */
  private validateDateRange(startDateStr: string, endDateStr: string) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (startDate >= endDate) {
      throw new BadRequestError(ErrorCode.INVALID_DATE_RANGE);
    }
  }

  /**
   * Validate team size
   */
  private validateTeamSize(minSize: number, maxSize: number) {
    if (minSize < 1) {
      throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);
    }
    if (maxSize <= minSize) {
      throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);
    }
  }

  /**
   * Create tournament record
   */
  private async createTournamentRecord(input: CreateTournamentInput) {
    return await tournamentRepository.create({
      name: input.name,
      description: input.description,
      mode: input.mode,
      teamMode: input.teamMode,
      minTeamSize: input.minTeamSize,
      maxTeamSize: input.maxTeamSize,
      maxMatchesPerPlayer: input.maxMatchesPerPlayer ?? 10,
      maxTimesWithSamePartner: input.maxTimesWithSamePartner ?? 2,
      maxTimesWithSameOpponent: input.maxTimesWithSameOpponent ?? 2,
      pointPerVictory: input.pointPerVictory ?? 3,
      pointPerDraw: input.pointPerDraw ?? 1,
      pointPerLoss: input.pointPerLoss ?? 0,
      allowDraw: input.allowDraw ?? true,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: input.createdBy,
      status: "draft",
    });
  }

  /**
   * Add creator as tournament owner
   */
  private async addCreatorAsOwner(
    tournamentId: string,
    userId: string
  ) {
    await tournamentRepository.addAdmin(tournamentId, userId, "owner");
  }

  /**
   * Get tournament by ID
   */
  async getTournamentById(id: string) {
    const tournament = await tournamentRepository.getById(id);

    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    return tournament;
  }

  /**
   * List all tournaments (with optional filters)
   */
  async listTournaments(filters?: {
    status?: TournamentStatus;
    mode?: TournamentMode;
    createdBy?: string;
  }) {
    return await tournamentRepository.list(filters);
  }

  /**
   * Update tournament
   */
  async updateTournament(
    id: string,
    userId: string,
    input: UpdateTournamentInput
  ) {
    await this.checkUpdatePermissions(id, userId);
    const tournament = await this.getTournamentById(id);
    this.validateUpdateFields(tournament, input);
    this.validateUpdateDates(tournament, input);
    this.validateUpdateTeamSize(tournament, input);

    return await tournamentRepository.update(id, {
      ...input,
      startDate: input.startDate,
      endDate: input.endDate,
    });
  }

  /**
   * Check user can update tournament
   */
  private async checkUpdatePermissions(
    tournamentId: string,
    userId: string
  ) {
    const canManage = await this.canManageTournament(tournamentId, userId);
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }
  }

  /**
   * Validate fields that can be updated based on tournament status
   */
  private validateUpdateFields(
    tournament: Awaited<ReturnType<typeof tournamentRepository.getById>>,
    input: UpdateTournamentInput
  ) {
    if (tournament?.status === "draft") {
      return;
    }

    const allowedFields = new Set([
      "description",
      "startDate",
      "endDate",
      "status",
    ]);
    const attemptedFields = Object.keys(input);
    const invalidFields = attemptedFields.filter(
      (field) => !allowedFields.has(field)
    );

    if (invalidFields.length > 0) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_FIELD_UPDATE_FORBIDDEN, {
        fields: invalidFields,
      });
    }
  }

  /**
   * Validate dates if provided in update
   */
  private validateUpdateDates(
    tournament: Awaited<ReturnType<typeof tournamentRepository.getById>>,
    input: UpdateTournamentInput
  ) {
    if (!input.startDate && !input.endDate) {
      return;
    }

    const startDate = new Date(input.startDate ?? tournament?.startDate ?? "");
    const endDate = new Date(input.endDate ?? tournament?.endDate ?? "");
    if (startDate >= endDate) {
      throw new BadRequestError(ErrorCode.INVALID_DATE_RANGE);
    }
  }

  /**
   * Validate team size if provided in update
   */
  private validateUpdateTeamSize(
    tournament: Awaited<ReturnType<typeof tournamentRepository.getById>>,
    input: UpdateTournamentInput
  ) {
    if (
      input.minTeamSize === undefined &&
      input.maxTeamSize === undefined
    ) {
      return;
    }

    const minSize = input.minTeamSize ?? tournament?.minTeamSize ?? 1;
    const maxSize = input.maxTeamSize ?? tournament?.maxTeamSize ?? 1;
    this.validateTeamSize(minSize, maxSize);
  }

  /**
   * Delete tournament
   */
  async deleteTournament(id: string, userId: string) {
    // Check permissions - only owner or super_admin can delete
    const user = await tournamentRepository.getUser(userId);

    if (!user) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND);
    }

    const tournament = await this.getTournamentById(id);

    // Super admin can delete anything
    const isSuperAdmin = user.role === "super_admin";
    // Owner can delete their tournament
    const isOwner = tournament.createdBy === userId;

    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Can only delete if status is draft
    if (tournament.status !== "draft") {
      throw new BadRequestError(ErrorCode.TOURNAMENT_CANNOT_BE_DELETED);
    }

    // Delete tournament (cascade will handle related records)
    await tournamentRepository.delete(id);

    return { success: true, message: "Tournament deleted successfully" };
  }

  /**
   * Change tournament status
   */
  async changeTournamentStatus(
    id: string,
    userId: string,
    newStatus: TournamentStatus
  ) {
    await this.checkUpdatePermissions(id, userId);
    const tournament = await this.getTournamentById(id);
    this.validateStatusTransition(tournament.status, newStatus);

    return await tournamentRepository.update(id, {
      status: newStatus,
    });
  }

  /**
   * Validate status transition is allowed
   */
  private validateStatusTransition(
    currentStatus: TournamentStatus,
    newStatus: TournamentStatus
  ) {
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      draft: ["open"],
      open: ["ongoing", "draft"],
      ongoing: ["finished"],
      finished: [],
    };

    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestError(ErrorCode.INVALID_STATUS_TRANSITION, {
        from: currentStatus,
        to: newStatus,
      });
    }
  }

  /**
   * Join tournament as participant
   */
  async joinTournament(userId: string, data: JoinTournamentRequest) {
    const tournament = await this.getTournamentForJoin(data.tournamentId);
    this.validateTournamentOpenForJoin(tournament);
    await this.checkNotAlreadyRegistered(userId, data.tournamentId);

    const participation = await participantRepository.createParticipation(
      userId,
      data.tournamentId
    );

    return await participantRepository.findParticipationWithDetails(
      participation.id
    );
  }

  /**
   * Get tournament for join validation
   */
  private async getTournamentForJoin(tournamentId: string) {
    const tournament = await participantRepository.findTournamentById(
      tournamentId
    );
    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }
    return tournament;
  }

  /**
   * Validate tournament is open for joining
   */
  private validateTournamentOpenForJoin(
    tournament: Awaited<
      ReturnType<typeof participantRepository.findTournamentById>
    >
  ) {
    if (!tournament || !["open", "ongoing"].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_CLOSED);
    }
  }

  /**
   * Check user is not already registered
   */
  private async checkNotAlreadyRegistered(
    userId: string,
    tournamentId: string
  ) {
    const existingParticipation =
      await participantRepository.findParticipationByUserAndTournament(
        userId,
        tournamentId
      );

    if (existingParticipation) {
      throw new ConflictError(ErrorCode.ALREADY_REGISTERED);
    }
  }

  /**
   * Leave tournament
   */
  async leaveTournament(userId: string, tournamentId: string) {
    // Vérifier que le tournoi existe
    const tournament = await participantRepository.findTournamentById(
      tournamentId
    );

    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    // Ne pas permettre de quitter un tournoi en cours ou terminé
    if (["ongoing", "finished"].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.CANNOT_LEAVE_ONGOING_TOURNAMENT);
    }

    // Vérifier que l'utilisateur est inscrit
    const participation =
      await participantRepository.findParticipationByUserAndTournament(
        userId,
        tournamentId
      );

    if (!participation) {
      throw new BadRequestError(ErrorCode.NOT_REGISTERED);
    }

    // Supprimer la participation
    await participantRepository.deleteParticipation(participation.id);

    return { message: "Vous avez quitté le tournoi avec succès" };
  }

  /**
   * Get tournament participants
   */
  async getTournamentParticipants(tournamentId: string) {
    return await participantRepository.findTournamentParticipants(tournamentId);
  }
}

export const tournamentService = new TournamentService();
