import { matchRepository } from "../../repository/match.repository";
import { userRepository } from "../../repository/user.repository";
import { BadRequestError, ConflictError, ErrorCode } from "../../types/errors";
import type { CreateMatchRequestData as CreateMatchInput } from "@skill-arena/shared/types/index";

type TournamentFromRepository = Awaited<
    ReturnType<typeof matchRepository.getTournament>
>;

/**
 * Validator for tournament rules (partner/opponent constraints, match limits)
 */
export class MatchRuleValidator {
    /**
     * Validate match rules against tournament settings
     */
    async validateMatchRules(
        input: CreateMatchInput & { matchId?: string },
        tournament: NonNullable<TournamentFromRepository>
    ): Promise<void> {
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
    ): Promise<void> {
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
            await this.validatePartnerConstraints(
                input,
                tournament,
                playerId,
                excludeMatchId
            );
            await this.validateOpponentConstraints(
                input,
                tournament,
                playerId,
                excludeMatchId
            );
        }
    }

    /**
     * Validate max matches per player
     */
    private async validatePlayerMatchLimit(
        tournament: NonNullable<TournamentFromRepository>,
        playerId: string,
        excludeMatchId?: string
    ): Promise<void> {
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
    ): Promise<void> {
        // Determine which team the player is in
        const isInTeamA = input.playerIdsA?.includes(playerId);
        const isInTeamB = input.playerIdsB?.includes(playerId);

        // Get the player's teammates (partners)
        let teammates: string[] = [];
        if (isInTeamA && input.playerIdsA) {
            teammates = input.playerIdsA.filter((id) => id !== playerId);
        } else if (isInTeamB && input.playerIdsB) {
            teammates = input.playerIdsB.filter((id) => id !== playerId);
        }

        // For flex tournaments, get team size to count only matches with same format
        const teamSize =
            tournament.teamMode === "flex" && input.playerIdsA
                ? input.playerIdsA.length
                : undefined;

        // Validate each teammate
        for (const teammateId of teammates) {
            const partnerCount = await matchRepository.countMatchesWithSamePartner(
                tournament.id,
                playerId,
                teammateId,
                excludeMatchId,
                teamSize // Pass team size for flex mode
            );

            if (partnerCount >= tournament.maxTimesWithSamePartner) {
                const [playerName, partnerName] = await Promise.all([
                    this.getPlayerName(playerId),
                    this.getPlayerName(teammateId),
                ]);
                throw new ConflictError(ErrorCode.MAX_PARTNER_MATCHES_EXCEEDED, {
                    max: tournament.maxTimesWithSamePartner,
                    playerName,
                    partnerName,
                    teamSize, // Add team size to error details
                });
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
    ): Promise<void> {
        // Determine which team the player is in
        const isInTeamA = input.playerIdsA?.includes(playerId);
        const isInTeamB = input.playerIdsB?.includes(playerId);

        // Get the opposing team's players
        let opponents: string[] = [];
        if (isInTeamA && input.playerIdsB) {
            opponents = input.playerIdsB;
        } else if (isInTeamB && input.playerIdsA) {
            opponents = input.playerIdsA;
        }

        // For flex tournaments, get team size to count only matches with same format
        const teamSize =
            tournament.teamMode === "flex" && input.playerIdsA
                ? input.playerIdsA.length
                : undefined;

        // Validate each opponent
        for (const opponentId of opponents) {
            const opponentCount = await matchRepository.countMatchesWithSameOpponent(
                tournament.id,
                playerId,
                opponentId,
                excludeMatchId,
                teamSize // Pass team size for flex mode
            );

            if (opponentCount >= tournament.maxTimesWithSameOpponent) {
                const [playerName, opponentName] = await Promise.all([
                    this.getPlayerName(playerId),
                    this.getPlayerName(opponentId),
                ]);
                throw new ConflictError(ErrorCode.MAX_OPPONENT_MATCHES_EXCEEDED, {
                    max: tournament.maxTimesWithSameOpponent,
                    playerName,
                    opponentName,
                    teamSize, // Add team size to error details
                });
            }
        }
    }

    /**
     * Get player display name
     */
    private async getPlayerName(playerId: string): Promise<string> {
        const player = await userRepository.getById(playerId);
        return player?.displayName || `Joueur ${playerId.substring(0, 8)}`;
    }
}

export const matchRuleValidator = new MatchRuleValidator();
