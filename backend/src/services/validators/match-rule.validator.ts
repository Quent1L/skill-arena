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
        const excludeMatchId = input.matchId;

        // Per-player match limit (unchanged)
        for (const playerId of allPlayerIds) {
            await this.validatePlayerMatchLimit(tournament, playerId, excludeMatchId);
        }

        // Partner check: once per team as a complete unit
        await this.validateTeamPartnerConstraints(input, tournament, input.playerIdsA, excludeMatchId);
        await this.validateTeamPartnerConstraints(input, tournament, input.playerIdsB, excludeMatchId);

        // Opponent check: complete team A vs complete team B
        await this.validateTeamOpponentConstraints(input, tournament, excludeMatchId);
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
     * Validate that a complete team hasn't exceeded the partner match limit.
     * Skipped for 1v1 (no partners).
     */
    private async validateTeamPartnerConstraints(
        input: CreateMatchInput & { matchId?: string },
        tournament: NonNullable<TournamentFromRepository>,
        teamPlayerIds: string[],
        excludeMatchId?: string
    ): Promise<void> {
        if (teamPlayerIds.length <= 1) return;

        const count = await matchRepository.countMatchesForTeam(
            tournament.id,
            teamPlayerIds,
            excludeMatchId,
        );

        if (count >= tournament.maxTimesWithSamePartner) {
            const names = await Promise.all(teamPlayerIds.map((id) => this.getPlayerName(id)));
            throw new ConflictError(ErrorCode.MAX_PARTNER_MATCHES_EXCEEDED, {
                max: tournament.maxTimesWithSamePartner,
                teamName: names.join(", "),
            });
        }
    }

    /**
     * Validate that the complete team A hasn't exceeded the opponent match limit against team B.
     */
    private async validateTeamOpponentConstraints(
        input: CreateMatchInput & { matchId?: string },
        tournament: NonNullable<TournamentFromRepository>,
        excludeMatchId?: string
    ): Promise<void> {
        if (!input.playerIdsA || !input.playerIdsB) return;

        const count = await matchRepository.countMatchesTeamsVsTeam(
            tournament.id,
            input.playerIdsA,
            input.playerIdsB,
            excludeMatchId,
        );

        if (count >= tournament.maxTimesWithSameOpponent) {
            const [namesA, namesB] = await Promise.all([
                Promise.all(input.playerIdsA.map((id) => this.getPlayerName(id))),
                Promise.all(input.playerIdsB.map((id) => this.getPlayerName(id))),
            ]);
            throw new ConflictError(ErrorCode.MAX_OPPONENT_MATCHES_EXCEEDED, {
                max: tournament.maxTimesWithSameOpponent,
                teamName: namesA.join(", "),
                opponentTeamName: namesB.join(", "),
            });
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
