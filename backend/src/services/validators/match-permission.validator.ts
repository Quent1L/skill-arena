import { matchRepository } from "../../repository/match.repository";
import { tournamentRepository } from "../../repository/tournament.repository";
import { userRepository } from "../../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../../types/errors";
import type { CreateMatchRequestData as CreateMatchInput } from "@skill-arena/shared/types/index";

type TournamentFromRepository = Awaited<
    ReturnType<typeof matchRepository.getTournament>
>;

/**
 * Validator for match permissions
 */
export class MatchPermissionValidator {
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
     * Check if user has permission to create match
     */
    async checkCreatePermissions(
        input: CreateMatchInput,
        createdBy: string,
        tournament: NonNullable<TournamentFromRepository>
    ): Promise<void> {
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
     * Validate user can report match
     */
    async validateReportPermissions(
        matchId: string,
        userId: string
    ): Promise<void> {
        const isParticipant = await matchRepository.isUserInMatch(matchId, userId);
        if (!isParticipant) {
            throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT);
        }
    }

    /**
     * Check if player is in match
     */
    private isPlayerInMatch(input: CreateMatchInput, playerId: string): boolean {
        if (input.playerIdsA?.includes(playerId)) {
            return true;
        }
        if (input.playerIdsB?.includes(playerId)) {
            return true;
        }
        return false;
    }
}

export const matchPermissionValidator = new MatchPermissionValidator();
