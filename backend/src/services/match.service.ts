import {
  matchRepository,
  type CreateMatchData,
  type UpdateMatchData,
} from '../repository/match.repository'
import { matchConfirmationRepository } from '../repository/match-confirmation.repository'
import { userRepository } from '../repository/user.repository'
import { entryRepository } from '../repository/entry.repository'
import {
  type CreateMatchRequestData as CreateMatchInput,
  type UpdateMatchRequestData as UpdateMatchInput,
  type ReportMatchResultRequestData as ReportMatchResultInput,
  type ConfirmMatchRequestData as ConfirmMatchInput,
  type ContestMatchRequestData as ContestMatchInput,
  type FinalizeMatchRequestData as FinalizeMatchInput,
  type RespondToMatchRequestData as RespondToMatchInput,
  type MatchStatus,
  type ListMatchCardsQuery,
  type ClientMatchCard,
  type PaginatedMatchCards,
} from '@skill-arena/shared/types/index'
import {
  ErrorCode,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  AppError,
} from '../types/errors'
import i18next from '../config/i18n'
import { matchSidesRepository } from '../repository/match-sides.repository'
import { notificationService } from './notification.service'
import { matchInputValidator } from './validators/match-input.validator'
import { logger } from '../utils/logger'
import { matchRuleValidator } from './validators/match-rule.validator'
import { matchPermissionValidator } from './validators/match-permission.validator'
import { matchStatusValidator } from './validators/match-status.validator'
import { standingsService } from './standings.service'
import { playerComputedDataRepository } from '../repository/player-computed-data.repository'
import { participantRepository } from '../repository/participant.repository'
import { rankedSeasonRepository } from '../repository/ranked-season.repository'
import { rankedSeasonService } from './ranked-season.service'
import { teamRepository } from '../repository/team.repository'
import { matchNotificationBuilder } from './match-notification.builder'
import { matchFinalizationOrchestrator } from './match-finalization.orchestrator'

type TournamentFromRepository = Awaited<ReturnType<typeof matchRepository.getTournament>>

const DEFAULT_AUTO_VALIDATION_HOURS = 24
const TRUST_SCORE_THRESHOLD = 10

export class MatchService {
  async canManageMatches(tournamentId: string, userId: string): Promise<boolean> {
    return await matchPermissionValidator.canManageMatches(tournamentId, userId)
  }

  async createMatch(input: CreateMatchInput, createdBy: string) {
    const tournament = await this.getAndValidateTournament(input.tournamentId)
    await this.runCreateValidations(input, createdBy, tournament)

    const matchId = await this.createMatchRecord(input, createdBy, tournament)

    if (input.status === 'reported') {
      return await this.handleReportedCreation(matchId, input, createdBy, tournament)
    }

    await matchNotificationBuilder.notifyMatchCreated(matchId, createdBy, tournament.name)
    return await matchRepository.getById(matchId)
  }

  private async runCreateValidations(
    input: CreateMatchInput,
    createdBy: string,
    tournament: NonNullable<TournamentFromRepository>,
  ): Promise<void> {
    await this.checkCreatePermissions(input, createdBy, tournament)
    await this.validateMatchInput(input, tournament)
    await this.validateMatchRules(input, tournament)

    if (tournament.mode === 'ranked') {
      matchInputValidator.validateRankedPlayedAt(input.playedAt)
      await this.autoRegisterRankedPlayers(input)
    }

    if (!tournament.scoreEnabled && input.status === 'reported') {
      matchInputValidator.validateWinnerRequired(input.winner)
      input.scoreA = null
      input.scoreB = null
    } else if (input.status === 'reported' && input.scoreA != null && input.scoreB != null) {
      matchInputValidator.validateScores(input.scoreA, input.scoreB)
      matchInputValidator.validateScoreRange(
        input.scoreA,
        input.scoreB,
        tournament.minScore,
        tournament.maxScore,
      )
      await matchInputValidator.validateDrawAllowed(
        input.tournamentId,
        input.scoreA,
        input.scoreB,
        input.winner,
      )
    }

    if (input.playedAt) {
      const playerIds = await this.resolvePlayerIds(input, tournament)
      await this.validateNoPlayerConflict(playerIds, input.playedAt, input.tournamentId)
    }
  }

  private async handleReportedCreation(
    matchId: string,
    input: CreateMatchInput,
    createdBy: string,
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    const creator = await userRepository.getById(createdBy)
    if (creator?.role !== 'kiosk') {
      await matchConfirmationRepository.upsert({
        matchId,
        playerId: createdBy,
        isConfirmed: true,
        isContested: false,
      })

      if (
        tournament.validationMode === 'auto' &&
        (creator?.trustScoreCount ?? 0) >= TRUST_SCORE_THRESHOLD
      ) {
        await this.finalizeMatch(matchId, { finalizationReason: 'trust_score' }, createdBy)
        await this.triggerStandingsRecalcIfNeeded(input.tournamentId, matchId)
        await matchNotificationBuilder.notifyMatchCreated(matchId, createdBy, tournament.name)
        return await matchRepository.getById(matchId)
      }
    }

    await this.checkAndFinalizeMatch(matchId)
    await this.triggerStandingsRecalcIfNeeded(input.tournamentId, matchId)

    const refreshed = await matchRepository.getById(matchId)
    if (refreshed?.status === 'reported') {
      await matchNotificationBuilder.notifyMatchValidationRequired(matchId, createdBy)
      this.recomputeProvisionalIfRanked(input.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )
    } else {
      await matchNotificationBuilder.notifyMatchCreated(matchId, createdBy, tournament.name)
    }

    return await matchRepository.getById(matchId)
  }

  private async triggerStandingsRecalcIfNeeded(
    tournamentId: string,
    matchId?: string,
  ): Promise<void> {
    const tournament = await matchRepository.getTournament(tournamentId)
    if (tournament?.mode === 'championship') {
      if (tournament.teamMode === 'flex' && tournament.maxMatchesPerPlayer) {
        await standingsService.recalculatePointsInternal(tournamentId)
      } else {
        await standingsService.invalidateCache(tournamentId)
      }
    }
    if (matchId) {
      const playerIds = await matchRepository.getPlayerIdsForMatch(matchId)
      if (playerIds.length > 0) {
        await playerComputedDataRepository.deleteMany(playerIds)
      }
    }
  }

  private async autoRegisterRankedPlayers(input: CreateMatchInput): Promise<void> {
    const allPlayerIds = [...(input.playerIdsA ?? []), ...(input.playerIdsB ?? [])]
    for (const playerId of allPlayerIds) {
      const existing = await participantRepository.findParticipationByUserAndTournament(
        playerId,
        input.tournamentId,
      )
      if (!existing) {
        await participantRepository.createParticipation(playerId, input.tournamentId)
      }
    }
  }

  private async getAndValidateTournament(tournamentId: string) {
    const tournament = await matchRepository.getTournament(tournamentId)
    if (!tournament) {
      throw new NotFoundError(ErrorCode.TOURNAMENT_NOT_FOUND)
    }

    if (!['open', 'ongoing'].includes(tournament.status)) {
      throw new BadRequestError(ErrorCode.TOURNAMENT_INVALID_STATUS)
    }

    return tournament
  }

  private async checkCreatePermissions(
    input: CreateMatchInput,
    createdBy: string,
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    await matchPermissionValidator.checkCreatePermissions(input, createdBy, tournament)
  }

  private async validateMatchInput(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    await matchInputValidator.validateMatchInput(input, tournament)
  }

  private async createMatchRecord(
    input: CreateMatchInput,
    createdBy: string,
    tournament?: TournamentFromRepository,
  ) {
    const matchData: CreateMatchData = {
      tournamentId: input.tournamentId,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      playerIdsA: input.playerIdsA,
      playerIdsB: input.playerIdsB,
      status: input.status ?? ('scheduled' as const),
      createdBy,
      playedAt: input.playedAt ? new Date(input.playedAt) : undefined,
    }

    if (input.status === 'reported' && input.scoreA !== undefined && input.scoreB !== undefined) {
      matchData.scoreA = input.scoreA
      matchData.scoreB = input.scoreB
      matchData.reportProof = input.reportProof
      matchData.outcomeTypeId = input.outcomeTypeId
      matchData.outcomeReasonId = input.outcomeReasonId
      matchData.reportedBy = createdBy
      matchData.confirmationDeadline = this.getDeadlineForTournament(tournament) ?? undefined
      const winner = this.deriveWinnerFromScores(input.scoreA, input.scoreB, input.winner)
      if (winner !== undefined) matchData.winner = winner
    }

    return await matchRepository.create(matchData)
  }

  private async validateMatchRules(
    input: CreateMatchInput & { matchId?: string },
    tournament: NonNullable<TournamentFromRepository>,
  ) {
    await matchRuleValidator.validateMatchRules(input, tournament)
  }

  async getMatchById(id: string) {
    const match = await matchRepository.getById(id)
    if (!match) {
      throw new NotFoundError(ErrorCode.MATCH_NOT_FOUND)
    }
    return match
  }

  async listMatches(filters?: {
    tournamentId?: string
    status?: MatchStatus
    round?: number
    playerId?: string
  }) {
    return await matchRepository.list(filters)
  }

  async listMatchCards(filters: ListMatchCardsQuery): Promise<PaginatedMatchCards> {
    const { data: rows, total } = await matchRepository.listMatchCards(filters)
    if (rows.length === 0) return { data: [], total: 0, hasMore: false }

    const matchIds = rows.map((r) => r.matchId)
    const sidesData = await matchSidesRepository.getByMatchIds(matchIds)

    const sidesByMatch = new Map<string, typeof sidesData>()
    for (const side of sidesData) {
      if (!sidesByMatch.has(side.matchId)) sidesByMatch.set(side.matchId, [])
      sidesByMatch.get(side.matchId)!.push(side)
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
        isWinner: row.winnerSide === (s.position === 1 ? 'A' : 'B'),
        players: s.entry.players.map((p) => ({
          id: p.player.id,
          displayName: p.player.displayName,
          shortName: p.player.shortName ?? p.player.displayName.slice(0, 8),
        })),
      })),
      outcomeType: row.outcomeTypeId
        ? { id: row.outcomeTypeId, name: row.outcomeTypeName ?? '' }
        : null,
      ...(filters.playerIds && {
        playerId: filters.playerIds.split(',')[0],
        mmrDelta: row.mmrDelta ?? null,
        pointsDelta: row.pointsDelta ?? null,
      }),
    }))

    return {
      data,
      total,
      hasMore: filters.offset + filters.limit < total,
    }
  }

  async updateMatch(id: string, input: UpdateMatchInput, updatedBy: string) {
    const match = await this.getMatchById(id)
    const tournament = await matchRepository.getTournament(match.tournamentId)

    await this.runUpdateValidations(id, match, updatedBy, tournament)

    const updateData = await this.buildUpdateMatchData(id, input, match, tournament, updatedBy)
    const result = await matchRepository.update(id, updateData)
    await notificationService.deleteActionsByMatchId(id)

    if (input.status === 'reported') {
      await this.handleReportedUpdate(id, updatedBy)
    }
    return result
  }

  private async runUpdateValidations(
    id: string,
    match: NonNullable<Awaited<ReturnType<typeof matchRepository.getById>>>,
    updatedBy: string,
    tournament: TournamentFromRepository,
  ): Promise<void> {
    const canManage = await this.canManageMatches(match.tournamentId, updatedBy)
    if (!canManage) {
      const isParticipant = await matchRepository.isUserInMatch(id, updatedBy)
      if (match.status !== 'scheduled' || !isParticipant) {
        throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
      }
    }

    if (match.status === 'confirmed') {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_CONFIRMED)
    }

    if (tournament?.mode === 'bracket') {
      const sides = (match as { sides?: { entryId: string }[] }).sides ?? []
      if (sides.length < 2) {
        throw new BadRequestError(ErrorCode.BRACKET_MATCH_TEAMS_NOT_READY)
      }
    }
  }

  private async buildUpdateMatchData(
    id: string,
    input: UpdateMatchInput,
    match: NonNullable<Awaited<ReturnType<typeof matchRepository.getById>>>,
    tournament: TournamentFromRepository,
    updatedBy: string,
  ): Promise<UpdateMatchData> {
    const updateData: UpdateMatchData = {}
    if (input.scoreA !== undefined) updateData.scoreA = input.scoreA
    if (input.scoreB !== undefined) updateData.scoreB = input.scoreB
    if (input.status !== undefined) updateData.status = input.status
    if (input.reportProof !== undefined) updateData.reportProof = input.reportProof
    if (input.outcomeTypeId !== undefined) updateData.outcomeTypeId = input.outcomeTypeId
    if (input.outcomeReasonId !== undefined) updateData.outcomeReasonId = input.outcomeReasonId
    if (input.winner !== undefined) updateData.winner = input.winner
    if (input.playedAt !== undefined) {
      updateData.playedAt = new Date(input.playedAt)
      const playerIds = await matchRepository.getPlayerIdsForMatch(id)
      await this.validateNoPlayerConflict(playerIds, input.playedAt, match.tournamentId, id)
    }

    if (input.status === 'reported') {
      const scoreA = input.scoreA ?? 0
      const scoreB = input.scoreB ?? 0
      matchInputValidator.validateScores(scoreA, scoreB)
      matchInputValidator.validateScoreRange(
        scoreA,
        scoreB,
        tournament?.minScore,
        tournament?.maxScore,
      )
      await matchInputValidator.validateDrawAllowed(
        match.tournamentId,
        scoreA,
        scoreB,
        input.winner,
      )

      updateData.reportedBy = updatedBy
      updateData.confirmationDeadline = this.getDeadlineForTournament(tournament)
    }
    return updateData
  }

  private async handleReportedUpdate(matchId: string, updatedBy: string): Promise<void> {
    const isParticipant = await matchRepository.isUserInMatch(matchId, updatedBy)
    if (isParticipant) {
      const updater = await userRepository.getById(updatedBy)
      if (updater?.role !== 'kiosk') {
        await matchConfirmationRepository.upsert({
          matchId,
          playerId: updatedBy,
          isConfirmed: true,
          isContested: false,
        })
      }
    }
    await this.checkAndFinalizeMatch(matchId)
    const refreshed = await matchRepository.getById(matchId)
    if (refreshed?.status === 'reported') {
      await matchNotificationBuilder.notifyMatchValidationRequired(matchId, updatedBy)
    }
  }

  async deleteMatch(id: string, deletedBy: string) {
    const match = await this.getMatchById(id)

    const canManage = await this.canManageMatches(match.tournamentId, deletedBy)
    if (!canManage) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
    }

    if (match.status === 'confirmed') {
      throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_DELETED)
    }

    await matchRepository.delete(id)

    return { success: true, message: 'Match supprimé avec succès' }
  }

  async reportMatchResult(id: string, input: ReportMatchResultInput, reportedBy: string) {
    const match = await this.getMatchById(id)
    await this.validateReportPermissions(id, reportedBy)
    await this.validateReportStatus(match.status)
    await this.validateScoreConstraints(match.tournamentId, input)

    const tournament = await matchRepository.getTournament(match.tournamentId)
    const updateData = this.buildReportUpdateData(input, match, reportedBy)
    updateData.confirmationDeadline = this.getDeadlineForTournament(tournament)

    const updatedMatch = await matchRepository.update(id, updateData)

    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: reportedBy,
      isConfirmed: true,
      isContested: false,
    })

    if (tournament?.validationMode === 'auto') {
      const reporter = await userRepository.getById(reportedBy)
      if ((reporter?.trustScoreCount ?? 0) >= TRUST_SCORE_THRESHOLD) {
        await this.finalizeMatch(id, { finalizationReason: 'trust_score' }, reportedBy)
        return await matchRepository.getById(id)
      }
    }

    await this.checkAndFinalizeMatch(id)

    const refreshed = await matchRepository.getById(id)
    if (refreshed?.status === 'reported') {
      await matchNotificationBuilder.notifyMatchValidationRequired(id, reportedBy)
    }

    if (refreshed?.status === 'reported' || refreshed?.status === 'pending_confirmation') {
      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )
    }

    return updatedMatch
  }

  private async validateReportPermissions(matchId: string, userId: string) {
    await matchPermissionValidator.validateReportPermissions(matchId, userId)
  }

  private validateReportStatus(status: MatchStatus) {
    matchStatusValidator.validateReportStatus(status)
  }

  private async validateScoreConstraints(tournamentId: string, input: ReportMatchResultInput) {
    matchInputValidator.validateScores(input.scoreA, input.scoreB)
    const tournament = await matchRepository.getTournament(tournamentId)
    matchInputValidator.validateScoreRange(
      input.scoreA,
      input.scoreB,
      tournament?.minScore,
      tournament?.maxScore,
    )
    await matchInputValidator.validateDrawAllowed(
      tournamentId,
      input.scoreA,
      input.scoreB,
      input.winner,
    )
  }

  private buildReportUpdateData(
    input: ReportMatchResultInput,
    _match: Awaited<ReturnType<typeof matchRepository.getById>>,
    reportedBy: string,
  ): UpdateMatchData {
    return {
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      status: 'reported',
      reportProof: input.reportProof,
      outcomeTypeId: input.outcomeTypeId,
      outcomeReasonId: input.outcomeReasonId,
      reportedBy,
      winner: this.deriveWinnerFromScores(input.scoreA, input.scoreB, input.winner) ?? null,
    }
  }

  async confirmMatch(id: string, _input: ConfirmMatchInput, confirmedBy: string) {
    const match = await this.getMatchById(id)

    const confirmer = await userRepository.getById(confirmedBy)
    if (confirmer?.role === 'kiosk') {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
    }

    const isParticipant = await matchRepository.isUserInMatch(id, confirmedBy)
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT)
    }

    if (!['reported', 'pending_confirmation'].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS)
    }

    if (match.status === 'finalized') {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED)
    }

    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: confirmedBy,
      isConfirmed: true,
      isContested: false,
    })

    await notificationService.deleteActionsByMatchIdForUser(id, confirmedBy)
    await this.checkAndFinalizeMatch(id)

    return await matchRepository.getById(id)
  }

  async contestMatch(id: string, input: ContestMatchInput, contestedBy: string) {
    const match = await this.getMatchById(id)

    const contester = await userRepository.getById(contestedBy)
    if (contester?.role === 'kiosk') {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
    }

    const isParticipant = await matchRepository.isUserInMatch(id, contestedBy)
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT)
    }

    if (!['reported', 'pending_confirmation'].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS)
    }

    if (match.status === 'finalized') {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED)
    }

    const hasScoreProposal =
      input.proposedScoreA !== undefined && input.proposedScoreB !== undefined

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
      proposedOutcomeTypeId: hasScoreProposal ? (input.proposedOutcomeTypeId ?? null) : null,
      proposedOutcomeReasonId: hasScoreProposal ? (input.proposedOutcomeReasonId ?? null) : null,
    })

    const originalReporter = match.result?.reportedBy
    if (originalReporter) {
      await userRepository.resetTrustScore(originalReporter)
    }

    if (hasScoreProposal) {
      await notificationService.deleteActionsByMatchIdForUser(id, contestedBy)
      await matchConfirmationRepository.resetConfirmationsExcept(id, contestedBy)

      const tournament = await matchRepository.getTournament(match.tournamentId)
      await matchRepository.update(id, {
        status: 'pending_confirmation',
        confirmationDeadline: this.getDeadlineForTournament(tournament),
      })

      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )

      await matchNotificationBuilder.notifyScoreProposal(
        id,
        contestedBy,
        input.proposedScoreA!,
        input.proposedScoreB!,
      )
    } else {
      await matchRepository.update(id, { status: 'disputed' })

      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )
    }

    return await matchRepository.getById(id)
  }

  async respondToMatch(id: string, input: RespondToMatchInput, respondedBy: string) {
    const match = await this.getMatchById(id)

    const responder = await userRepository.getById(respondedBy)
    if (responder?.role === 'kiosk') {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
    }

    const isParticipant = await matchRepository.isUserInMatch(id, respondedBy)
    if (!isParticipant) {
      throw new ForbiddenError(ErrorCode.NOT_A_PARTICIPANT)
    }

    if (match.status === 'finalized') {
      return this.handlePostFinalizationDispute(id, match, input, respondedBy)
    }

    return this.handlePreFinalizationResponse(id, match, input, respondedBy)
  }

  private async handlePostFinalizationDispute(
    id: string,
    match: NonNullable<Awaited<ReturnType<typeof matchRepository.getById>>>,
    input: RespondToMatchInput,
    respondedBy: string,
  ) {
    if (input.type === 'agree') {
      throw new BadRequestError(ErrorCode.CANNOT_AGREE_AFTER_FINALIZATION)
    }

    const tournament = await matchRepository.getTournament(match.tournamentId)
    if (tournament?.validationMode !== 'auto') {
      throw new BadRequestError(ErrorCode.DISPUTE_NOT_ALLOWED_FOR_VALIDATION_MODE)
    }

    const finalizedAt = match.result?.finalizedAt
    if (!finalizedAt) {
      throw new BadRequestError(ErrorCode.MATCH_NOT_FOUND)
    }

    const daysSinceFinalization = (Date.now() - new Date(finalizedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceFinalization > 7) {
      throw new BadRequestError(ErrorCode.DISPUTE_WINDOW_EXPIRED)
    }

    const alreadyDisputed = await matchConfirmationRepository.hasPlayerDisputedPostFinalization(id, respondedBy)
    if (alreadyDisputed) {
      throw new BadRequestError(ErrorCode.ALREADY_DISPUTED)
    }

    const participants = await matchRepository.getParticipationsByMatchId(id)
    const sidePosition = participants.find((p) => p.playerId === respondedBy)?.teamSide === 'A' ? 1 : 2

    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: respondedBy,
      isConfirmed: false,
      isContested: true,
      contestationReason: input.reason,
      contestationProof: input.proof,
      sidePosition,
      isPostFinalization: true,
    })

    return await matchRepository.getById(id)
  }

  private async handlePreFinalizationResponse(
    id: string,
    match: NonNullable<Awaited<ReturnType<typeof matchRepository.getById>>>,
    input: RespondToMatchInput,
    respondedBy: string,
  ) {
    if (!['reported', 'pending_confirmation', 'disputed'].includes(match.status)) {
      throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS)
    }

    const participants = await matchRepository.getParticipationsByMatchId(id)
    const sidePosition = participants.find((p) => p.playerId === respondedBy)?.teamSide === 'A' ? 1 : 2

    if (input.type === 'agree') {
      await matchConfirmationRepository.upsert({
        matchId: id,
        playerId: respondedBy,
        isConfirmed: true,
        isContested: false,
        sidePosition,
        isPostFinalization: false,
      })

      await notificationService.deleteActionsByMatchIdForUser(id, respondedBy)
      await this.checkAndFinalizeMatch(id)

      return await matchRepository.getById(id)
    }

    // dispute
    const hasScoreProposal = input.proposedScoreA !== undefined && input.proposedScoreB !== undefined

    await matchConfirmationRepository.upsert({
      matchId: id,
      playerId: respondedBy,
      isConfirmed: false,
      isContested: true,
      contestationReason: input.reason,
      contestationProof: input.proof,
      proposedScoreA: hasScoreProposal ? input.proposedScoreA : null,
      proposedScoreB: hasScoreProposal ? input.proposedScoreB : null,
      proposedWinner: hasScoreProposal ? (input.proposedWinner ?? null) : null,
      proposedOutcomeTypeId: hasScoreProposal ? (input.proposedOutcomeTypeId ?? null) : null,
      proposedOutcomeReasonId: hasScoreProposal ? (input.proposedOutcomeReasonId ?? null) : null,
      sidePosition,
      isPostFinalization: false,
    })

    const originalReporter = match.result?.reportedBy
    if (originalReporter) {
      await userRepository.resetTrustScore(originalReporter)
    }

    if (hasScoreProposal) {
      await notificationService.deleteActionsByMatchIdForUser(id, respondedBy)
      await matchConfirmationRepository.resetConfirmationsExcept(id, respondedBy)

      const tournament = await matchRepository.getTournament(match.tournamentId)
      await matchRepository.update(id, {
        status: 'pending_confirmation',
        confirmationDeadline: this.getDeadlineForTournament(tournament),
      })

      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )

      await matchNotificationBuilder.notifyScoreProposal(
        id,
        respondedBy,
        input.proposedScoreA!,
        input.proposedScoreB!,
      )
    } else {
      await matchRepository.update(id, { status: 'disputed' })

      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )
    }

    return await matchRepository.getById(id)
  }

  async validateMatch(input: CreateMatchInput & { matchId?: string }) {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const tournament = await this.getTournamentForValidation(input)
      if (!tournament) {
        errors.push('Tournoi non trouvé')
        return { valid: false, errors, warnings }
      }

      if (!this.isTournamentOpenForMatches(tournament)) {
        errors.push('Le tournoi doit être ouvert ou en cours pour créer des matchs')
        return { valid: false, errors, warnings }
      }

      await this.validateMatchInputForValidation(input, tournament, errors)
      await this.validateTournamentRulesForValidation(input, tournament, errors)
      if (input.playedAt) {
        const playerIds = await this.resolvePlayerIds(input, tournament)
        const conflict = await matchRepository.findPlayerConflictAtTime(
          playerIds,
          new Date(input.playedAt),
          input.tournamentId,
          input.matchId,
        )
        if (conflict) {
          errors.push(`${conflict.playerName} a déjà un match à cette date et heure`)
        }
      }
      await this.checkSimilarMatch(input, warnings, input.matchId)

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
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Erreur inattendue lors de la validation',
      )
      return { valid: false, errors, warnings }
    }
  }

  private async getTournamentForValidation(input: CreateMatchInput) {
    return await matchRepository.getTournament(input.tournamentId)
  }

  private isTournamentOpenForMatches(tournament: TournamentFromRepository): boolean {
    return tournament ? ['open', 'ongoing'].includes(tournament.status) : false
  }

  private async validateMatchInputForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[],
  ) {
    await matchInputValidator.validateMatchInputForValidation(input, tournament, errors)
  }

  private async validateTournamentRulesForValidation(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
    errors: string[],
  ) {
    if (tournament.teamMode === 'flex' && input.playerIdsA && input.playerIdsB) {
      try {
        await this.validateMatchRules(input, tournament)
      } catch (error) {
        if (error instanceof AppError) {
          const translatedMessage = String(i18next.t(`errors.${error.code}`, error.details || {}))
          errors.push(translatedMessage)
        } else {
          const fallbackMessage = String(i18next.t('errors.UNKNOWN'))
          errors.push(error instanceof Error ? error.message : fallbackMessage)
        }
      }
    }
  }

  private async checkSimilarMatch(
    input: CreateMatchInput & { matchId?: string },
    warnings: string[],
    excludeMatchId?: string,
  ) {
    let entryAId: string | undefined
    let entryBId: string | undefined

    try {
      if (input.teamAId && input.teamBId) {
        const entryA = await entryRepository.findExistingEntry(
          input.tournamentId,
          input.teamAId,
          undefined,
        )
        const entryB = await entryRepository.findExistingEntry(
          input.tournamentId,
          input.teamBId,
          undefined,
        )
        entryAId = entryA?.id
        entryBId = entryB?.id
      } else if (input.playerIdsA && input.playerIdsB) {
        const entryA = await entryRepository.findExistingEntry(
          input.tournamentId,
          undefined,
          input.playerIdsA,
        )
        const entryB = await entryRepository.findExistingEntry(
          input.tournamentId,
          undefined,
          input.playerIdsB,
        )
        entryAId = entryA?.id
        entryBId = entryB?.id
      }

      if (!entryAId || !entryBId) return

      const duplicates = await matchRepository.findMatchesWithSameEntries(
        input.tournamentId,
        entryAId,
        entryBId,
        excludeMatchId,
      )

      if (duplicates.length > 0) {
        warnings.push('Un match similaire existe déjà')
      }
    } catch (error) {
      logger.error({ err: error }, 'Error checking for duplicate matches')
    }
  }

  private async checkAndFinalizeMatch(matchId: string) {
    const match = await matchRepository.getById(matchId)
    if (!match) return

    if (match.status === 'finalized' || match.status === 'disputed') return
    if (!['reported', 'pending_confirmation'].includes(match.status)) return

    const participants = await matchRepository.getParticipationsByMatchId(matchId)
    if (participants.length === 0) return

    const confirmations = await matchConfirmationRepository.getByMatchId(matchId)

    if (this.detectSimpleContestation(confirmations)) {
      await matchRepository.update(matchId, { status: 'disputed' })
      return
    }

    const tournament = await matchRepository.getTournament(match.tournamentId)
    if (tournament?.validationMode === 'admin') return

    const activeProposal = await matchConfirmationRepository.getActiveProposal(matchId)
    const proposerPlayerId =
      match.status === 'pending_confirmation' ? activeProposal?.playerId : undefined

    const effectiveConfirmations = confirmations.map((c) =>
      c.playerId === proposerPlayerId ? { ...c, isConfirmed: true } : c,
    )

    // Current score submitter: proposer (pending_confirmation) or original reporter
    const currentReporter =
      match.status === 'pending_confirmation'
        ? proposerPlayerId
        : match.result?.reportedBy
    const reporterSide = participants.find((p) => p.playerId === currentReporter)?.teamSide

    const opponentConfirmed = effectiveConfirmations.some((c) => {
      if (!c.isConfirmed || c.isContested) return false
      const side = participants.find((p) => p.playerId === c.playerId)?.teamSide
      return reporterSide ? side !== reporterSide : c.playerId !== currentReporter
    })

    if (opponentConfirmed) {
      await this.applyActiveProposal(matchId, activeProposal)
      await this.finalizeMatch(matchId, { finalizationReason: 'consensus' })
    }
  }

  async cancelMatch(id: string, cancelledBy: string) {
    const match = await this.getMatchById(id)

    const canceller = await userRepository.getById(cancelledBy)
    if (canceller?.role === 'kiosk') {
      if (match.createdBy !== cancelledBy) {
        throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
      }
    } else {
      const isAdmin = await this.canManageMatches(match.tournamentId, cancelledBy)
      const isParticipant = await matchRepository.isUserInMatch(id, cancelledBy)
      if (!isAdmin && !isParticipant) {
        throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
      }
    }

    if (match.status === 'finalized') {
      await this.cancelFinalizedMatch(id, match, cancelledBy)
      return await matchRepository.getById(id)
    }

    matchStatusValidator.validateCanCancel(match.status)

    const wasUnfinalized = ['reported', 'pending_confirmation', 'disputed'].includes(match.status)
    await matchRepository.update(id, { status: 'cancelled' })
    await notificationService.deleteActionsByMatchId(id)
    if (wasUnfinalized) {
      this.recomputeProvisionalIfRanked(match.tournamentId).catch((err) =>
        logger.error({ err }, '[Ranked] background cache update failed'),
      )
    }

    return await matchRepository.getById(id)
  }

  private async cancelFinalizedMatch(
    id: string,
    match: NonNullable<Awaited<ReturnType<typeof matchRepository.getById>>>,
    cancelledBy: string,
  ): Promise<void> {
    const tournament = await matchRepository.getTournament(match.tournamentId)
    if (!['championship', 'ranked'].includes(tournament?.mode ?? '')) {
      throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_CANCELLED)
    }

    const reason = match.result?.finalizationReason
    if (!['auto_validation', 'trust_score'].includes(reason ?? '')) {
      throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_CANCELLED)
    }

    if (match.result?.reportedBy !== cancelledBy) {
      throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS)
    }

    const finalizedAt = match.result?.finalizedAt
    if (!finalizedAt) throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_CANCELLED)
    const hoursSince = (Date.now() - new Date(finalizedAt).getTime()) / (1000 * 60 * 60)
    if (hoursSince > 48) throw new BadRequestError(ErrorCode.CANCEL_WINDOW_EXPIRED)

    await matchRepository.update(id, { status: 'cancelled' })
    await notificationService.deleteActionsByMatchId(id)
    await matchFinalizationOrchestrator.runPostCancellationEffects(id, match.tournamentId)
  }

  async finalizeMatch(
    id: string,
    input: FinalizeMatchInput,
    finalizedBy?: string,
    backgroundTasks?: Promise<void>[],
  ) {
    const match = await this.getMatchById(id)

    if (match.status === 'finalized') {
      throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED)
    }

    const updateData: UpdateMatchData = {
      status: 'finalized',
      finalizedAt: new Date(),
      finalizationReason: input.finalizationReason,
    }
    if (finalizedBy) {
      updateData.finalizedBy = finalizedBy
    }

    const result = await matchRepository.update(id, updateData)
    await matchFinalizationOrchestrator.runPostFinalizationEffects(
      id,
      match.tournamentId,
      backgroundTasks,
    )

    if (['consensus', 'auto_validation', 'trust_score'].includes(input.finalizationReason)) {
      const reportedBy = match.result?.reportedBy
      if (reportedBy) {
        await userRepository.incrementTrustScore(reportedBy)
      }
    }

    return result
  }

  async autoFinalizeExpiredMatches() {
    const now = new Date()
    const expiredMatches = await matchRepository.getMatchesPendingFinalization()

    const finalized: string[] = []
    const disputed: string[] = []
    const backgroundTasks: Promise<void>[] = []

    for (const match of expiredMatches) {
      if (!match.confirmationDeadline) continue
      if (new Date(match.confirmationDeadline) > now) continue

      const confirmations = await matchConfirmationRepository.getByMatchId(match.id)

      if (this.detectSimpleContestation(confirmations)) {
        disputed.push(match.id)
        continue
      }

      const activeProposal = await matchConfirmationRepository.getActiveProposal(match.id)
      await this.applyActiveProposal(match.id, activeProposal)
      await this.finalizeMatch(
        match.id,
        { finalizationReason: 'auto_validation' },
        undefined,
        backgroundTasks,
      )
      finalized.push(match.id)
    }

    // Wait for all background tasks to complete before returning
    if (backgroundTasks.length > 0) {
      await Promise.allSettled(backgroundTasks)
    }

    return {
      finalized,
      disputed,
      total: finalized.length + disputed.length,
    }
  }

  private detectSimpleContestation(
    confirmations: Awaited<ReturnType<typeof matchConfirmationRepository.getByMatchId>>,
  ): boolean {
    return confirmations.some(
      (c) => c.isContested && (c.proposedScoreA === null || c.proposedScoreA === undefined),
    )
  }

  private async applyActiveProposal(
    matchId: string,
    activeProposal: Awaited<
      ReturnType<typeof matchConfirmationRepository.getActiveProposal>
    > | null,
  ): Promise<void> {
    if (
      !activeProposal ||
      activeProposal.proposedScoreA === null ||
      activeProposal.proposedScoreA === undefined ||
      activeProposal.proposedScoreB === null ||
      activeProposal.proposedScoreB === undefined
    ) {
      return
    }

    const updateData: UpdateMatchData = {
      scoreA: activeProposal.proposedScoreA,
      scoreB: activeProposal.proposedScoreB,
    }

    if (activeProposal.proposedWinner !== null && activeProposal.proposedWinner !== undefined) {
      updateData.winner = activeProposal.proposedWinner as 'teamA' | 'teamB' | null
    }
    if (
      activeProposal.proposedOutcomeTypeId !== null &&
      activeProposal.proposedOutcomeTypeId !== undefined
    ) {
      updateData.outcomeTypeId = activeProposal.proposedOutcomeTypeId
    }
    if (
      activeProposal.proposedOutcomeReasonId !== null &&
      activeProposal.proposedOutcomeReasonId !== undefined
    ) {
      updateData.outcomeReasonId = activeProposal.proposedOutcomeReasonId
    }

    await matchRepository.update(matchId, updateData)
  }

  private deriveWinnerFromScores(
    scoreA: number | null | undefined,
    scoreB: number | null | undefined,
    explicitWinner: 'teamA' | 'teamB' | null | undefined,
  ): 'teamA' | 'teamB' | null | undefined {
    if (explicitWinner !== undefined) return explicitWinner
    if (scoreA == null || scoreB == null) return undefined
    if (scoreA > scoreB) return 'teamA'
    if (scoreB > scoreA) return 'teamB'
    return null
  }

  private buildConfirmationDeadline(hours: number): Date {
    const deadline = new Date()
    deadline.setHours(deadline.getHours() + hours)
    return deadline
  }

  private getDeadlineForTournament(tournament: TournamentFromRepository): Date | null {
    if (tournament?.validationMode !== 'auto') return null
    return this.buildConfirmationDeadline(
      tournament.validationTimerHours ?? DEFAULT_AUTO_VALIDATION_HOURS,
    )
  }

  private async recomputeProvisionalIfRanked(tournamentId: string): Promise<void> {
    const rankedConfig = await rankedSeasonRepository.getConfigByTournamentId(tournamentId)
    if (rankedConfig) {
      rankedSeasonService
        .computeAndCacheProvisional(tournamentId)
        .catch((err) => logger.error({ err }, '[Ranked] background cache update failed'))
    }
  }

  private async resolvePlayerIds(
    input: CreateMatchInput,
    tournament: NonNullable<TournamentFromRepository>,
  ): Promise<string[]> {
    if (tournament.teamMode === 'flex') {
      return [...(input.playerIdsA ?? []), ...(input.playerIdsB ?? [])]
    }
    const ids: string[] = []
    if (input.teamAId) {
      const teamA = await teamRepository.getById(input.teamAId)
      if (teamA) ids.push(...teamA.members.map((m) => m.userId))
    }
    if (input.teamBId) {
      const teamB = await teamRepository.getById(input.teamBId)
      if (teamB) ids.push(...teamB.members.map((m) => m.userId))
    }
    return ids
  }

  private async validateNoPlayerConflict(
    playerIds: string[],
    playedAt: Date | string,
    tournamentId: string,
    excludeMatchId?: string,
  ): Promise<void> {
    if (playerIds.length === 0) return
    const conflict = await matchRepository.findPlayerConflictAtTime(
      playerIds,
      new Date(playedAt),
      tournamentId,
      excludeMatchId,
    )
    if (conflict) {
      throw new ConflictError(ErrorCode.PLAYER_SCHEDULE_CONFLICT, {
        playerName: conflict.playerName,
      })
    }
  }
}

export const matchService = new MatchService()
