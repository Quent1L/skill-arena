import { matchRepository } from "../../repository/match.repository";
import { userRepository } from "../../repository/user.repository";
import { teamRepository } from "../../repository/team.repository";
import { BadRequestError, ErrorCode } from "../../types/errors";
import type { CreateMatchRequestData as CreateMatchInput, MatchSideInput } from "@skol-arena/shared/types/index";
import { t } from "../../utils/i18n-context";

type TournamentFromRepository = Awaited<
    ReturnType<typeof matchRepository.getTournament>
>;

export class MatchInputValidator {
    async validateMatchInput(
        input: CreateMatchInput,
        tournament: NonNullable<TournamentFromRepository>
    ): Promise<void> {
        const sides = input.sides ?? [];
        if (sides.length < 2) {
            throw new BadRequestError(
                tournament.teamMode === "static"
                    ? ErrorCode.MATCH_INVALID_TEAMS
                    : ErrorCode.MATCH_INVALID_PLAYERS
            );
        }

        if (tournament.teamMode === "static") {
            await this.validateStaticSides(sides, tournament);
        } else {
            await this.validateFlexSides(sides, input.tournamentId);
        }
    }

    private async validateStaticSides(
        sides: MatchSideInput[],
        tournament: NonNullable<TournamentFromRepository>
    ): Promise<void> {
        for (const side of sides) {
            if (!side.teamId) {
                throw new BadRequestError(ErrorCode.MATCH_INVALID_TEAMS);
            }
        }

        const teamIds = sides.map((s) => s.teamId!);
        if (new Set(teamIds).size !== teamIds.length) {
            throw new BadRequestError(ErrorCode.MATCH_INVALID_TEAMS);
        }

        for (const teamId of teamIds) {
            await matchRepository.validateEntriesForTournament(
                tournament.id,
                teamId
            );
            const size = await teamRepository.getMemberCount(teamId);
            if (size < tournament.minTeamSize || size > tournament.maxTeamSize) {
                throw new BadRequestError(ErrorCode.TEAM_SIZE_INVALID);
            }
        }
    }

    private async validateFlexSides(
        sides: MatchSideInput[],
        tournamentId: string
    ): Promise<void> {
        for (const side of sides) {
            if (!side.playerIds || side.playerIds.length === 0) {
                throw new BadRequestError(ErrorCode.MATCH_INVALID_PLAYERS);
            }
        }

        const allPlayerIds = sides.flatMap((s) => s.playerIds ?? []);
        if (new Set(allPlayerIds).size !== allPlayerIds.length) {
            throw new BadRequestError(ErrorCode.MATCH_OVERLAPPING_PLAYERS);
        }

        for (const side of sides) {
            await matchRepository.validateEntriesForTournament(
                tournamentId,
                undefined,
                undefined,
                side.playerIds,
                []
            );
        }
    }

    validateWinnerRequired(winnerPosition?: number | null, allowDraw = false): void {
        if (winnerPosition === null && allowDraw) return;
        if (winnerPosition === undefined || winnerPosition === null) {
            throw new BadRequestError(ErrorCode.MATCH_WINNER_REQUIRED);
        }
    }

    validateScores(scoreA: number, scoreB: number): void {
        if (scoreA < 0 || scoreB < 0) {
            throw new BadRequestError(ErrorCode.MATCH_INVALID_SCORE);
        }
    }

    validateScoreRange(
        scoreA: number,
        scoreB: number,
        minScore: number | null | undefined,
        maxScore: number | null | undefined
    ): void {
        if (minScore != null && (scoreA < minScore || scoreB < minScore)) {
            throw new BadRequestError(ErrorCode.MATCH_SCORE_OUT_OF_RANGE);
        }
        if (maxScore != null && (scoreA > maxScore || scoreB > maxScore)) {
            throw new BadRequestError(ErrorCode.MATCH_SCORE_OUT_OF_RANGE);
        }
    }

    async validateDrawAllowed(
        tournamentId: string,
        scoreA: number,
        scoreB: number,
        winnerPosition?: number | null,
    ): Promise<void> {
        const isDraw = winnerPosition === null || (winnerPosition === undefined && scoreA === scoreB);
        if (!isDraw) return;

        const tournament = await matchRepository.getTournament(tournamentId);
        if (!tournament?.allowDraw) {
            throw new BadRequestError(ErrorCode.MATCH_DRAW_NOT_ALLOWED);
        }
    }

    validateRankedPlayedAt(playedAt: Date | string | undefined): void {
        if (!playedAt) {
            throw new BadRequestError(ErrorCode.RANKED_MATCH_TOO_OLD);
        }
        const played = new Date(playedAt);
        const diffMs = Date.now() - played.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours > 48) {
            throw new BadRequestError(ErrorCode.RANKED_MATCH_TOO_OLD);
        }
    }

    async validateMatchInputForValidation(
        input: CreateMatchInput & { allPlayerIds?: string[] },
        tournament: NonNullable<TournamentFromRepository>,
        errors: string[]
    ): Promise<void> {
        if (input.allPlayerIds && input.allPlayerIds.length > 0) {
            await this.validateAllPlayerIdsForValidation(
                input.allPlayerIds, input.tournamentId, tournament, errors
            );
            return;
        }

        const sides = input.sides ?? [];
        if (sides.length === 0) return;

        if (tournament.teamMode === "static") {
            await this.validateStaticSidesForValidation(sides, tournament, errors);
        } else {
            await this.validateFlexSidesForValidation(sides, input.tournamentId, errors);
        }
    }

    private async validateAllPlayerIdsForValidation(
        allPlayerIds: string[],
        tournamentId: string,
        tournament: NonNullable<TournamentFromRepository>,
        errors: string[]
    ): Promise<void> {
        const min = tournament.minTeamSize * 2;
        const max = tournament.maxTeamSize * 2;
        if (allPlayerIds.length < min || allPlayerIds.length > max) {
            errors.push(
                `Le match nécessite entre ${min} et ${max} joueurs ` +
                `(${tournament.minTeamSize}-${tournament.maxTeamSize} par équipe), ` +
                `${allPlayerIds.length} sélectionné(s)`
            );
            return;
        }
        try {
            await matchRepository.validateEntriesForTournament(
                tournamentId, undefined, undefined, allPlayerIds, []
            );
        } catch (error) {
            errors.push(
                error instanceof Error ? error.message : "Joueur non inscrit au tournoi"
            );
        }
    }

    private async validateStaticSidesForValidation(
        sides: MatchSideInput[],
        tournament: NonNullable<TournamentFromRepository>,
        errors: string[]
    ): Promise<void> {
        const teamIds = sides.map((s) => s.teamId).filter(Boolean) as string[];

        for (const teamId of teamIds) {
            try {
                await matchRepository.validateEntriesForTournament(
                    tournament.id,
                    teamId
                );
            } catch (error) {
                errors.push(
                    error instanceof Error ? error.message : `Équipe invalide`
                );
            }
        }

        if (teamIds.length >= 2 && new Set(teamIds).size !== teamIds.length) {
            errors.push("Les équipes ne peuvent pas être identiques");
        }

        if (teamIds.length >= 2) {
            await this.validateTeamSizesForValidation(
                teamIds,
                tournament.minTeamSize,
                tournament.maxTeamSize,
                errors
            );
        }
    }

    private async validateTeamSizesForValidation(
        teamIds: string[],
        minTeamSize: number,
        maxTeamSize: number,
        errors: string[]
    ): Promise<void> {
        const sizes = await Promise.all(
            teamIds.map((id) => teamRepository.getMemberCount(id))
        );
        sizes.forEach((size, i) => {
            if (size < minTeamSize || size > maxTeamSize) {
                errors.push(
                    `L'équipe ${i + 1} a ${size} membre(s), attendu entre ${minTeamSize} et ${maxTeamSize}`
                );
            }
        });
    }

    private async validateFlexSidesForValidation(
        sides: MatchSideInput[],
        tournamentId: string,
        errors: string[]
    ): Promise<void> {
        for (let i = 0; i < sides.length; i++) {
            const side = sides[i];
            if (!side.playerIds || side.playerIds.length === 0) continue;

            try {
                await matchRepository.validateEntriesForTournament(
                    tournamentId,
                    undefined,
                    undefined,
                    side.playerIds,
                    []
                );
            } catch (error) {
                errors.push(
                    error instanceof Error
                        ? error.message
                        : `Erreur de validation joueurs équipe ${i + 1}`
                );
            }
        }

        if (sides.length >= 2) {
            await this.checkOverlappingPlayersForValidation(sides, errors);
        }
    }

    private async checkOverlappingPlayersForValidation(
        sides: MatchSideInput[],
        errors: string[]
    ): Promise<void> {
        const allIds = sides.flatMap((s) => s.playerIds ?? []);
        const seen = new Set<string>();
        for (const id of allIds) {
            if (seen.has(id)) {
                const player = await userRepository.getById(id);
                const playerName = player?.displayName || id;
                errors.push(
                    t("errors.MATCH_OVERLAPPING_PLAYERS", { playerName })
                );
                return;
            }
            seen.add(id);
        }
    }
}

export const matchInputValidator = new MatchInputValidator();
