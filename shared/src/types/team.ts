import { type TournamentAdminRole } from "./enums";

// ============================================
// Types et interfaces pour les équipes et participants
// ============================================

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  isFlexTeam: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string; // ISO date string
  leftAt?: string; // ISO date string
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  userId: string;
  joinedAt: string; // ISO date string
  leftAt?: string; // ISO date string
}

export interface TournamentAdmin {
  id: string;
  tournamentId: string;
  userId: string;
  role: TournamentAdminRole;
  assignedAt: string; // ISO date string
  assignedBy: string; // userId
}

// ============================================
// Types pour les statistiques
// ============================================

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
