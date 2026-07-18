import { matchRepository } from '../repository/match.repository'
import { userRepository } from '../repository/user.repository'
import { notificationService } from './notification.service'

type Participation = Awaited<ReturnType<typeof matchRepository.getParticipationsByMatchId>>[number]

interface ParticipantContext {
  teammates: string
  opponents: string
  matchFormat: string
}

export class MatchNotificationBuilder {
  async notifyMatchCreated(
    matchId: string,
    createdBy: string,
    tournamentName: string,
  ): Promise<void> {
    const match = await matchRepository.getById(matchId)
    if (!match) return

    const participants = await matchRepository.getParticipationsByMatchId(matchId)
    const creator = await userRepository.getById(createdBy)
    const creatorName = creator?.displayName ?? null
    const matchDate = this.serializeMatchDate(match.playedAt)
    const isScheduled =
      match.status === 'scheduled' || (match.playedAt && new Date(match.playedAt) > new Date())

    const titleKey = isScheduled
      ? 'notifications.MATCH_SCHEDULED_TITLE'
      : 'notifications.MATCH_CREATED_TITLE'
    const messageKey = isScheduled
      ? 'notifications.MATCH_SCHEDULED_MESSAGE'
      : 'notifications.MATCH_CREATED_MESSAGE'

    const recipients = this.recipientsExcept(participants, createdBy)
    for (const playerId of recipients) {
      const ctx = await this.resolveTeammatesAndOpponents(participants, playerId)
      if (!ctx) continue
      await notificationService.send({
        userId: playerId,
        type: 'match_created',
        titleKey,
        messageKey,
        translationParams: {
          creatorName,
          tournamentName,
          matchFormat: ctx.matchFormat,
          matchDate,
          opponents: ctx.opponents,
          teammates: ctx.teammates,
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: false,
        matchId,
      })
    }
  }

  async notifyMatchValidationRequired(matchId: string, reportedBy: string): Promise<void> {
    const match = await matchRepository.getById(matchId)
    if (!match) return

    const tournament = await matchRepository.getTournament(match.tournamentId)
    const participants = await matchRepository.getParticipationsByMatchId(matchId)
    const reporter = await userRepository.getById(reportedBy)
    const reporterName = reporter?.displayName ?? null
    const matchDate = this.serializeMatchDate(match.playedAt)

    const recipients = this.recipientsExcept(participants, reportedBy)
    for (const playerId of recipients) {
      const ctx = await this.resolveTeammatesAndOpponents(participants, playerId)
      if (!ctx) continue
      await notificationService.send({
        userId: playerId,
        type: 'MATCH_VALIDATION',
        titleKey: 'notifications.MATCH_VALIDATION_TITLE',
        messageKey: 'notifications.MATCH_VALIDATION_MESSAGE',
        translationParams: {
          reporterName,
          tournamentName: tournament?.name ?? '',
          matchFormat: ctx.matchFormat,
          matchDate,
          opponents: ctx.opponents,
          teammates: ctx.teammates,
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: true,
        matchId,
      })
    }
  }

  async notifyScoreProposal(
    matchId: string,
    proposedBy: string,
    proposedScoreA: number,
    proposedScoreB: number,
  ): Promise<void> {
    const match = await matchRepository.getById(matchId)
    if (!match) return

    const participants = await matchRepository.getParticipationsByMatchId(matchId)
    const proposer = await userRepository.getById(proposedBy)
    const proposerName = proposer?.displayName ?? null

    const recipients = this.recipientsExcept(participants, proposedBy)
    for (const playerId of recipients) {
      await notificationService.send({
        userId: playerId,
        type: 'MATCH_SCORE_PROPOSAL',
        titleKey: 'notifications.MATCH_SCORE_PROPOSAL_TITLE',
        messageKey: 'notifications.MATCH_SCORE_PROPOSAL_MESSAGE',
        translationParams: {
          proposerName,
          scoreA: String(proposedScoreA),
          scoreB: String(proposedScoreB),
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: true,
        matchId,
      })
    }
  }

  async notifyPostFinalizationDispute(matchId: string, disputedBy: string): Promise<void> {
    const match = await matchRepository.getById(matchId)
    if (!match) return

    const tournament = await matchRepository.getTournament(match.tournamentId)
    const participants = await matchRepository.getParticipationsByMatchId(matchId)
    const disputer = await userRepository.getById(disputedBy)
    const disputerName = disputer?.displayName ?? null
    const matchDate = this.serializeMatchDate(match.playedAt)

    const recipients = this.recipientsExcept(participants, disputedBy)
    for (const playerId of recipients) {
      await notificationService.send({
        userId: playerId,
        type: 'MATCH_POST_DISPUTE',
        titleKey: 'notifications.MATCH_POST_DISPUTE_TITLE',
        messageKey: 'notifications.MATCH_POST_DISPUTE_MESSAGE',
        translationParams: {
          disputerName,
          tournamentName: tournament?.name ?? '',
          matchDate,
        },
        actionUrl: `/matches/${matchId}`,
        requiresAction: false,
        matchId,
      })
    }
  }

  private recipientsExcept(participants: Participation[], excludeUserId: string): string[] {
    return [...new Set(participants.map((p) => p.playerId))].filter(
      (id) => id !== excludeUserId,
    )
  }

  /**
   * Stores the raw instant, never a pre-formatted string: the reader's device owns
   * the locale and the timezone. `null` is resolved to a localized "to be defined".
   */
  private serializeMatchDate(playedAt: Date | string | null | undefined): string | null {
    return playedAt ? new Date(playedAt).toISOString() : null
  }

  private async resolveTeammatesAndOpponents(
    participants: Participation[],
    forPlayerId: string,
  ): Promise<ParticipantContext | null> {
    const self = participants.find((p) => p.playerId === forPlayerId)
    if (!self) return null

    const teamA = participants.filter((p) => p.teamSide === 'A')
    const teamB = participants.filter((p) => p.teamSide === 'B')
    const isTeamA = self.teamSide === 'A'
    const teammates = (isTeamA ? teamA : teamB).filter((p) => p.playerId !== forPlayerId)
    const opponents = isTeamA ? teamB : teamA

    const teammateNames = await Promise.all(
      teammates.map(async (p) => {
        const user = await userRepository.getById(p.playerId)
        return user?.displayName ?? ''
      }),
    )
    const opponentNames = await Promise.all(
      opponents.map(async (p) => {
        const user = await userRepository.getById(p.playerId)
        return user?.displayName ?? ''
      }),
    )

    // Empty strings, not French labels: the client resolves them with its own locale
    return {
      teammates: teammateNames.filter(Boolean).join(', '),
      opponents: opponentNames.filter(Boolean).join(', '),
      matchFormat: `${teamA.length}v${teamA.length}`,
    }
  }
}

export const matchNotificationBuilder = new MatchNotificationBuilder()
