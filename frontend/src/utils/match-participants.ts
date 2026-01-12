import type { Match, MatchParticipant, MatchParticipantPlayer } from '@/types/match'
import type { User } from '@/types/user'

/**
 * Helper to retrieve a participant by their position (1 or 2)
 */
export function getParticipant(match: Match, position: number): MatchParticipant | undefined {
    if (!match.participants) return undefined
    return match.participants.find((p) => p.position === position)
}

/**
 * Helper to get participant by role (HOME/AWAY or SEED_1/SEED_2)
 */
export function getParticipantByRole(match: Match, role: 'HOME' | 'AWAY' | 'SEED_1' | 'SEED_2'): MatchParticipant | undefined {
    if (!match.participants) return undefined
    return match.participants.find((p) => p.role === role)
}

/**
 * Get display name for a participant
 * Handles both Static (Team) and Flex (Players) modes
 */
export function getParticipantName(participant?: MatchParticipant): string {
    if (!participant) return 'TBD'

    // Static Mode: Team
    if (participant.team) {
        return participant.team.name
    }

    // Flex Mode: Players
    if (participant.players && participant.players.length > 0) {
        return participant.players
            .map((p) => p.player?.displayName ?? 'Joueur')
            .join(', ')
    }

    return 'TBD'
}

/**
 * Get score for a position, defaults to 0
 */
export function getScore(match: Match, position: number): number {
    return getParticipant(match, position)?.score ?? 0
}

/**
 * Check if a participant is the winner
 */
export function isWinner(match: Match, position: number): boolean {
    return getParticipant(match, position)?.isWinner ?? false
}

/**
 * Get all player IDs involved in a match (for conflict checking etc)
 */
export function getAllPlayerIds(match: Match): string[] {
    if (!match.participants) return []

    const ids: string[] = []
    match.participants.forEach(p => {
        if (p.players) {
            p.players.forEach(pp => ids.push(pp.playerId))
        }
    })
    return ids
}
