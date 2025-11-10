import { type MatchStatus } from "./enums";

// ============================================
// Types et interfaces pour les matchs
// ============================================

export interface Match {
  id: string;
  tournamentId: string;
  round?: number;
  status: MatchStatus;
  scheduledAt?: string; // ISO date string
  playedAt?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface MatchResult {
  matchId: string;
  team1Score: number;
  team2Score: number;
  reportedBy: string; // userId
  confirmedBy?: string; // userId
  reportedAt: string; // ISO date string
  confirmedAt?: string; // ISO date string
}

export interface MatchParticipant {
  id: string;
  matchId: string;
  userId: string;
  teamNumber: number; // 1 or 2
  isSubstitute: boolean;
  joinedAt: string; // ISO date string
}
