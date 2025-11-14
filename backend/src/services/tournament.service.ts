import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { participantRepository } from "../repository/participant.repository";
import {
  type CreateTournamentInput,
  type UpdateTournamentInput,
  type TournamentMode,
  type TournamentStatus,
  type JoinTournamentRequest,
} from "@skill-arena/shared";
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
    // Validate user permissions
    const canCreate = await this.canCreateTournament(input.createdBy);
    if (!canCreate) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Validate max 5 drafts rule
    const draftCount = await this.countDraftTournaments(input.createdBy);
    if (draftCount >= 5) {
      throw new ConflictError(ErrorCode.MAX_DRAFT_TOURNAMENTS_EXCEEDED, {
        max: 5,
        current: draftCount,
      });
    }

    // Validate dates
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (startDate >= endDate) {
      throw new BadRequestError(ErrorCode.INVALID_DATE_RANGE);
    }

    if (input.minTeamSize < 1)
      throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);

    if (input.maxTeamSize <= input.minTeamSize)
      throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);

    // Create tournament
    const tournament = await tournamentRepository.create({
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

    // Add creator as owner in tournament_admins
    await tournamentRepository.addAdmin(
      tournament.id,
      input.createdBy,
      "owner"
    );

    return tournament;
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
    // Check permissions
    const canManage = await this.canManageTournament(id, userId);
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Get current tournament
    const tournament = await this.getTournamentById(id);

    // If tournament is not draft, restrict what can be changed
    if (tournament.status !== "draft") {
      // Can only update description and dates after draft
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

    // Validate dates if provided
    if (input.startDate || input.endDate) {
      const startDate = new Date(input.startDate ?? tournament.startDate);
      const endDate = new Date(input.endDate ?? tournament.endDate);
      if (startDate >= endDate) {
        throw new BadRequestError(ErrorCode.INVALID_DATE_RANGE);
      }
    }

    // Validate team size if provided
    if (input.minTeamSize !== undefined || input.maxTeamSize !== undefined) {
      const minSize = input.minTeamSize ?? tournament.minTeamSize;
      const maxSize = input.maxTeamSize ?? tournament.maxTeamSize;
      if (minSize < 1) {
        throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);
      }
      if (maxSize <= minSize) {
        throw new BadRequestError(ErrorCode.INVALID_TEAM_SIZE);
      }
    }

    // Update tournament
    const updated = await tournamentRepository.update(id, {
      ...input,
      // Ensure dates are strings if provided
      startDate: input.startDate,
      endDate: input.endDate,
    });

    return updated;
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
    const canManage = await this.canManageTournament(id, userId);
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    const tournament = await this.getTournamentById(id);

    // Validate status transitions
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      draft: ["open"],
      open: ["ongoing", "draft"],
      ongoing: ["finished"],
      finished: [], // Cannot change from finished
    };

    const allowedTransitions = validTransitions[tournament.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestError(ErrorCode.INVALID_STATUS_TRANSITION, {
        from: tournament.status,
        to: newStatus,
      });
    }

    const updated = await tournamentRepository.update(id, {
      status: newStatus,
    });

    return updated;
  }

  /**
   * Join tournament as participant
   */
  async joinTournament(userId: string, data: JoinTournamentRequest) {
    const { tournamentId } = data;

    // Vérifier que le tournoi existe et est dans un état valide
    const tournament = await participantRepository.findTournamentById(
      tournamentId
    );

    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND);
    }

    if (!["open", "ongoing"].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_CLOSED);
    }

    // Vérifier que l'utilisateur n'est pas déjà inscrit
    const existingParticipation =
      await participantRepository.findParticipationByUserAndTournament(
        userId,
        tournamentId
      );

    if (existingParticipation) {
      throw new ConflictError(ErrorCode.ALREADY_REGISTERED);
    }

    // Inscrire l'utilisateur
    const participation = await participantRepository.createParticipation(
      userId,
      tournamentId
    );

    // Retourner les détails de la participation avec les informations du tournoi et de l'utilisateur
    const participationWithDetails =
      await participantRepository.findParticipationWithDetails(
        participation.id
      );

    return participationWithDetails;
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
