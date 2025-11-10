import { type MatchStatus } from "./enums";
export interface Match {
    id: string;
    tournamentId: string;
    round?: number;
    status: MatchStatus;
    scheduledAt?: string;
    playedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface MatchResult {
    matchId: string;
    team1Score: number;
    team2Score: number;
    reportedBy: string;
    confirmedBy?: string;
    reportedAt: string;
    confirmedAt?: string;
}
export interface MatchParticipant {
    id: string;
    matchId: string;
    userId: string;
    teamNumber: number;
    isSubstitute: boolean;
    joinedAt: string;
}
