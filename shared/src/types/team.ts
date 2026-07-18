import { z } from "zod";
import { type TournamentAdminRole } from "./enums";

// ============================================
// Types and interfaces for static teams
// ============================================

export interface ClientTeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  user: { id: string; displayName: string; shortName: string };
}

export interface ClientTeam {
  id: string;
  tournamentId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: ClientTeamMember[];
  hasMatch: boolean;
}

export const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

// ============================================
// Types kept for backward compatibility
// ============================================

export interface TournamentAdmin {
  id: string;
  tournamentId: string;
  userId: string;
  role: TournamentAdminRole;
  assignedAt: string;
  assignedBy: string;
}

// ============================================
// Types for statistics
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
