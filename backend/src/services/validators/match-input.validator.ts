import { matchRepository } from "../../repository/match.repository";
import { BadRequestError, ErrorCode } from "../../types/errors";
import type { CreateMatchRequestData as CreateMatchInput } from "@skill-arena/shared/types/index";
import i18next from "../../config/i18n";

type TournamentFromRepository = Awaited<
    ReturnType<typeof matchRepository.getTournament>
>;

/**
 * Validator for match input data (teams, players, scores)
 */
export class MatchInputValidator {
    /**
     * Validate match input based on team mode
     */
    async validateMatchInput(
        input: CreateMatchInput,
        tournament: NonNullable<TournamentFromRepository>
    ): Promise<void> {
        if (tournament.teamMode === "static") {
            await this.validateStaticTeamInput(input);
        } else if (tournament.teamMode === "flex") {
            await this.validateFlexTeamInput(input);
        }
    }

    /**
     * Validate static team input
     */
    private async validateStaticTeamInput(
        input: CreateMatchInput
    ): Promise<void> {
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
    private async validateFlexTeamInput(input: CreateMatchInput): Promise<void> {
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
     * Validate scores are non-negative
     */
    validateScores(scoreA: number, scoreB: number): void {
        if (scoreA < 0 || scoreB < 0) {
            throw new BadRequestError(ErrorCode.MATCH_INVALID_SCORE);
        }
    }

    /**
     * Validate draw is allowed if scores are equal
     */
    async validateDrawAllowed(
        tournamentId: string,
        scoreA: number,
        scoreB: number
    ): Promise<void> {
        if (scoreA !== scoreB) {
            return;
        }

        const tournament = await matchRepository.getTournament(tournamentId);
        if (!tournament?.allowDraw) {
            throw new BadRequestError(ErrorCode.MATCH_DRAW_NOT_ALLOWED);
        }
    }

    /**
     * Validate match input for validation endpoint
     */
    async validateMatchInputForValidation(
        input: CreateMatchInput,
        tournament: NonNullable<TournamentFromRepository>,
        errors: string[]
    ): Promise<void> {
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
    ): Promise<void> {
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
    ): Promise<void> {
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
    ): Promise<void> {
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
    ): Promise<void> {
        try {
            await matchRepository.validatePlayersForTournament(
                tournamentId,
                playerIds
            );
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
    ): Promise<void> {
        if (!input.playerIdsA || !input.playerIdsB) return;

        const overlappingPlayers = input.playerIdsA.filter((playerId: string) =>
            input.playerIdsB?.includes(playerId)
        );
        if (overlappingPlayers.length > 0) {
            const errorMessage = String(
                i18next.t("errors.MATCH_OVERLAPPING_PLAYERS", {
                    playerName: overlappingPlayers[0],
                })
            );
            errors.push(errorMessage);
        }
    }
}

export const matchInputValidator = new MatchInputValidator();
