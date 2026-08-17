import { z } from "zod";
import { type TournamentAdminRole } from "./enums";

// ============================================
// Types and interfaces for static teams
// ============================================

export const clientTeamMemberSchema = z
  .object({
    id: z.string(),
    teamId: z.string(),
    userId: z.string(),
    joinedAt: z.iso.datetime(),
    user: z.object({
      id: z.string(),
      displayName: z.string(),
      shortName: z.string(),
    }),
  })
  .meta({ id: "TeamMember" });

export type ClientTeamMember = z.infer<typeof clientTeamMemberSchema>;

export const clientTeamSchema = z
  .object({
    id: z.string(),
    tournamentId: z.string(),
    name: z.string(),
    createdBy: z.string(),
    createdAt: z.iso.datetime(),
    members: z.array(clientTeamMemberSchema),
    hasMatch: z.boolean(),
  })
  .meta({ id: "Team" });

export type ClientTeam = z.infer<typeof clientTeamSchema>;

export const clientTeamListSchema = z.array(clientTeamSchema);

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
