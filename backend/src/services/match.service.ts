import { matchRepository } from "../repository/match.repository";
import { tournamentRepository } from "../repository/tournament.repository";
import { userRepository } from "../repository/user.repository";
import { db } from "../config/database";
import { matches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
  type CreateMatchRequestData as CreateMatchInput,
  type UpdateMatchRequestData as UpdateMatchInput,
  type ReportMatchResultRequestData as ReportMatchResultInput,
  type ConfirmMatchResultRequestData as ConfirmMatchResultInput,
  type MatchStatus,
} from "@skill-arena/shared/types/index";

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
    // Get tournament
    const tournament = await matchRepository.getTournament(input.tournamentId);
    if (!tournament) {
      throw new Error("Tournoi non trouvé");
    }

    // Check if tournament allows creating matches
    if (!["open", "ongoing"].includes(tournament.status)) {
      throw new Error(
        "Le tournoi doit être ouvert ou en cours pour créer des matchs"
      );
    }

    if (!this.isPlayerInMatch(input, createdBy)) {
      // Check permissions
      const canManage = await this.canManageMatches(
        input.tournamentId,
        createdBy
      );
      if (!canManage) {
        throw new Error(
          "Vous n'avez pas la permission de créer des matchs pour d'autres joueurs dans ce tournoi"
        );
      }
    }

    // Validate input based on team mode
    if (tournament.teamMode === "static") {
      if (!input.teamAId || !input.teamBId) {
        throw new Error(
          "Pour les équipes statiques, teamAId et teamBId sont requis"
        );
      }
      await matchRepository.validateTeamsForTournament(
        input.tournamentId,
        input.teamAId,
        input.teamBId
      );
    } else if (tournament.teamMode === "flex") {
      if (
        !input.playerIdsA ||
        !input.playerIdsB ||
        input.playerIdsA.length === 0 ||
        input.playerIdsB.length === 0
      ) {
        throw new Error(
          "Pour les équipes flexibles, playerIdsA et playerIdsB sont requis"
        );
      }
      await matchRepository.validatePlayersForTournament(input.tournamentId, [
        ...input.playerIdsA,
        ...input.playerIdsB,
      ]);
    }

    // Check tournament rules
    await this.validateMatchRules(input, tournament);

    // Create match
    const matchData = {
      tournamentId: input.tournamentId,
      round: input.round,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      status: input.status ?? ("scheduled" as const),
    };

    const match = await matchRepository.create(matchData);

    // For flex teams, create participations
    if (
      tournament.teamMode === "flex" &&
      input.playerIdsA &&
      input.playerIdsB
    ) {
      const participations = [
        ...input.playerIdsA.map((playerId: string) => ({
          matchId: match.id,
          playerId,
          teamSide: "A" as const,
        })),
        ...input.playerIdsB.map((playerId: string) => ({
          matchId: match.id,
          playerId,
          teamSide: "B" as const,
        })),
      ];

      for (const participation of participations) {
        await matchRepository.createMatchParticipation(participation);
      }
    }

    return await matchRepository.getById(match.id);
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
  private async validateMatchRules(input: CreateMatchInput, tournament: any) {
    // For flex teams, check player constraints
    if (
      tournament.teamMode === "flex" &&
      input.playerIdsA &&
      input.playerIdsB
    ) {
      const allPlayerIds = [...input.playerIdsA, ...input.playerIdsB];

      for (const playerId of allPlayerIds) {
        // Check max matches per player
        const playerMatchCount = await matchRepository.countMatchesForUser(
          tournament.id,
          playerId
        );
        if (playerMatchCount >= tournament.maxMatchesPerPlayer) {
          throw new Error(
            `Le joueur a atteint le nombre maximum de matchs (${tournament.maxMatchesPerPlayer})`
          );
        }

        // Check partner constraints
        for (const otherPlayerId of input.playerIdsA) {
          if (otherPlayerId !== playerId) {
            const partnerCount =
              await matchRepository.countMatchesWithSamePartner(
                tournament.id,
                playerId,
                otherPlayerId
              );
            if (partnerCount >= tournament.maxTimesWithSamePartner) {
              throw new Error(
                `Le joueur a déjà joué ${tournament.maxTimesWithSamePartner} fois avec ce partenaire`
              );
            }
          }
        }

        for (const otherPlayerId of input.playerIdsB) {
          const opponentCount =
            await matchRepository.countMatchesWithSameOpponent(
              tournament.id,
              playerId,
              otherPlayerId
            );
          if (opponentCount >= tournament.maxTimesWithSameOpponent) {
            throw new Error(
              `Le joueur a déjà joué ${tournament.maxTimesWithSameOpponent} fois contre cet adversaire`
            );
          }
        }
      }
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
   * Get match by ID
   */
  async getMatchById(id: string) {
    const match = await matchRepository.getById(id);
    if (!match) {
      throw new Error("Match non trouvé");
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
      throw new Error("Vous n'avez pas la permission de modifier ce match");
    }

    // Can only update certain fields based on status
    if (match.status === "confirmed") {
      throw new Error("Impossible de modifier un match confirmé");
    }

    const updateData: any = {};
    if (input.round !== undefined) updateData.round = input.round;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.reportProof !== undefined)
      updateData.reportProof = input.reportProof;

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
      throw new Error("Vous n'avez pas la permission de supprimer ce match");
    }

    // Can only delete if not confirmed
    if (match.status === "confirmed") {
      throw new Error("Impossible de supprimer un match confirmé");
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

    // Check if user is participant in the match
    const isParticipant = await matchRepository.isUserInMatch(id, reportedBy);
    if (!isParticipant) {
      throw new Error("Seuls les participants peuvent reporter le résultat");
    }

    // Check if match can be reported
    if (
      !["scheduled", "reported", "pending_confirmation"].includes(match.status)
    ) {
      throw new Error("Le match ne peut pas être reporté dans son état actuel");
    }

    // Validate scores
    if (input.scoreA < 0 || input.scoreB < 0) {
      throw new Error("Les scores ne peuvent pas être négatifs");
    }

    // Check draw allowance
    const tournament = await matchRepository.getTournament(match.tournamentId);
    if (input.scoreA === input.scoreB && !tournament?.allowDraw) {
      throw new Error("Les matchs nuls ne sont pas autorisés dans ce tournoi");
    }

    const updateData: {
      scoreA: number;
      scoreB: number;
      reportedBy: string;
      reportedAt: Date;
      status: "reported";
      reportProof?: string;
      winnerId?: string;
    } = {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      reportedBy,
      reportedAt: new Date(),
      status: "reported",
      reportProof: input.reportProof,
    };

    // Determine winner
    if (input.scoreA > input.scoreB) {
      updateData.winnerId = match.teamAId || undefined;
    } else if (input.scoreB > input.scoreA) {
      updateData.winnerId = match.teamBId || undefined;
    }
    // Draw case handled by null winnerId

    return await matchRepository.update(id, updateData);
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
      throw new Error("Seuls les participants peuvent confirmer le résultat");
    }

    // Check if match is in reported state
    if (match.status !== "reported") {
      throw new Error(
        "Le match doit être dans l'état 'reported' pour être confirmé"
      );
    }

    // Check if same user who reported is not confirming
    if (match.reportedBy === confirmedBy) {
      throw new Error(
        "Le même utilisateur ne peut pas reporter et confirmer le résultat"
      );
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
  async validateMatch(input: CreateMatchInput) {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get tournament
      const tournament = await matchRepository.getTournament(
        input.tournamentId
      );
      if (!tournament) {
        errors.push("Tournoi non trouvé");
        return { valid: false, errors, warnings };
      }

      // Check if tournament allows creating matches
      if (!["open", "ongoing"].includes(tournament.status)) {
        errors.push(
          "Le tournoi doit être ouvert ou en cours pour créer des matchs"
        );
        return { valid: false, errors, warnings };
      }

      // Validate input based on what is provided
      if (tournament.teamMode === "static") {
        if (input.teamAId) {
          try {
            await matchRepository.validateTeamsForTournament(
              input.tournamentId,
              input.teamAId,
              undefined
            );
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : "Erreur de validation équipe A"
            );
          }
        }

        if (input.teamBId) {
          try {
            await matchRepository.validateTeamsForTournament(
              input.tournamentId,
              undefined,
              input.teamBId
            );
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : "Erreur de validation équipe B"
            );
          }
        }

        if (input.teamAId && input.teamBId) {
          // Check if teams are different
          if (input.teamAId === input.teamBId) {
            errors.push("Les deux équipes ne peuvent pas être identiques");
          }
        }
      } else if (tournament.teamMode === "flex") {
        if (input.playerIdsA) {
          try {
            await matchRepository.validatePlayersForTournament(
              input.tournamentId,
              input.playerIdsA
            );
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : "Erreur de validation joueurs équipe A"
            );
          }
        }

        if (input.playerIdsB) {
          try {
            await matchRepository.validatePlayersForTournament(
              input.tournamentId,
              input.playerIdsB
            );
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : "Erreur de validation joueurs équipe B"
            );
          }
        }

        // Check for overlapping players only if both arrays are provided
        if (input.playerIdsA && input.playerIdsB) {
          const overlappingPlayers = input.playerIdsA.filter(
            (playerId: string) => input.playerIdsB?.includes(playerId)
          );
          if (overlappingPlayers.length > 0) {
            errors.push("Un joueur ne peut pas être dans les deux équipes");
          }
        }
      }

      // If we have enough information, validate tournament rules
      if (
        tournament.teamMode === "flex" &&
        input.playerIdsA &&
        input.playerIdsB
      ) {
        try {
          await this.validateMatchRules(input, tournament);
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error.message
              : "Violation des règles du tournoi"
          );
        }
      }

      // Check if a similar match already exists
      if (input.teamAId && input.teamBId) {
        const existingMatch = await db.query.matches.findFirst({
          where: and(
            eq(matches.tournamentId, input.tournamentId),
            eq(matches.teamAId, input.teamAId),
            eq(matches.teamBId, input.teamBId)
          ),
        });
        if (existingMatch) {
          warnings.push("Un match similaire existe déjà");
        }
      }

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
}

export const matchService = new MatchService();
