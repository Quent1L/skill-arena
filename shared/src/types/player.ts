// ============================================
// Types pour le profil et les statistiques d'un joueur
// ============================================

import { z } from "zod";
import { tournamentModeSchema } from "./enums";

export interface PlayerProfile {
  id: string;
  displayName: string;
  shortName: string;
}

export interface PlayerRelationStat {
  playerId: string;
  displayName: string;
  shortName: string;
  count: number;
  wins: number;
  losses: number;
  chemistryDelta?: number;
}

export interface PlayerOutcomeTypeStat {
  outcomeTypeId: string;
  outcomeTypeName: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  winRate: number;
}

export interface PlayerH2HStat {
  opponentId: string;
  displayName: string;
  shortName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface PlayerTournamentEntry {
  tournamentId: string;
  tournamentName: string;
  mode: string;
  disciplineName?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points?: number;
  rank?: number;
}

export interface PlayerDetailStats {
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  averageScore: number;
  tournamentsParticipated: number;
  recentForm: Array<'V' | 'D' | 'N'>;
  mostFrequentPartners: PlayerRelationStat[];
  bestPartners: PlayerRelationStat[];
  nemeses: PlayerRelationStat[];
  outcomeTypeStats: PlayerOutcomeTypeStat[];
  h2hStats: PlayerH2HStat[];
  tournamentHistory: PlayerTournamentEntry[];
}

export interface PlayerStatsFilters {
  tournamentId?: string;
  disciplineId?: string;
  tournamentMode?: string;
}

export interface PlayerStatsResponse {
  player: PlayerProfile;
  stats: PlayerDetailStats;
  filters: PlayerStatsFilters;
}

export interface PlayerTournamentOption {
  id: string;
  name: string;
  mode: string;
  disciplineId?: string;
  disciplineName?: string;
}

export const playerStatsFiltersSchema = z.object({
  tournamentId: z.string().uuid().optional(),
  disciplineId: z.string().uuid().optional(),
  tournamentMode: tournamentModeSchema.optional(),
});

export type PlayerStatsFiltersQuery = z.infer<typeof playerStatsFiltersSchema>;
