import { type TournamentAdminRole } from "./enums";
export interface Team {
    id: string;
    tournamentId: string;
    name: string;
    isFlexTeam: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    joinedAt: string;
    leftAt?: string;
}
export interface TournamentParticipant {
    id: string;
    tournamentId: string;
    userId: string;
    joinedAt: string;
    leftAt?: string;
}
export interface TournamentAdmin {
    id: string;
    tournamentId: string;
    userId: string;
    role: TournamentAdminRole;
    assignedAt: string;
    assignedBy: string;
}
export interface PlayerStats {
    userId: string;
    tournamentId: string;
    matchesPlayed: number;
    matchesWon: number;
    matchesDrawn: number;
    matchesLost: number;
    totalPoints: number;
    averageScore: number;
    winRate: number;
}
export interface TeamStats {
    teamId: string;
    tournamentId: string;
    matchesPlayed: number;
    matchesWon: number;
    matchesDrawn: number;
    matchesLost: number;
    totalPoints: number;
    goalDifference?: number;
}
