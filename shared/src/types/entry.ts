import { z } from "zod";

// ============================================
// Types for tournament entries (entry-based system)
// ============================================

/**
 * Entry type enum - determines how the entry is composed
 */
export type EntryType = "PLAYER" | "TEAM";

export const entryTypeSchema = z.enum(["PLAYER", "TEAM"]);

/**
 * Tournament Entry - represents a participant entity in a tournament
 * Can be either a TEAM (static mode) or individual PLAYER(S) (flex mode)
 */
export interface TournamentEntry {
  id: string;
  tournamentId: string;
  entryType: EntryType;
  teamId?: string;
  createdAt: string;
}

/**
 * Tournament Entry with relations
 */
export interface TournamentEntryModel extends TournamentEntry {
  team?: {
    id: string;
    name: string;
  };
  players: Array<{
    playerId: string;
    player: {
      id: string;
      displayName: string;
      shortName: string;
    };
  }>;
}

/**
 * Match Side - represents one participant side in a match
 */
export interface MatchSide {
  id: string;
  matchId: string;
  entryId: string;
  position: number; // 1, 2, 3... (supports N-way matches in future)
  score: number;
  pointsAwarded: number;
}

/**
 * Match Side with entry relations
 */
export interface MatchSideModel extends MatchSide {
  entry?: TournamentEntryModel;
}

/**
 * Match Result - stores reporting and finalization metadata
 */
export interface MatchResult {
  matchId: string;
  reportedBy?: string;
  reportedAt?: string;
  reportProof?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  finalizationReason?: "consensus" | "auto_validation" | "admin_override";
}

/**
 * Match Result with relations
 */
export interface MatchResultModel extends MatchResult {
  reporter?: {
    id: string;
    displayName: string;
  };
  finalizer?: {
    id: string;
    displayName: string;
  };
}

// ============================================
// Client types (with Date objects instead of strings)
// ============================================

/**
 * Client-side Tournament Entry (dates as Date objects)
 */
export interface ClientTournamentEntry extends Omit<TournamentEntry, 'createdAt'> {
  createdAt: Date;
}

/**
 * Client-side Tournament Entry Model (dates as Date objects)
 */
export interface ClientTournamentEntryModel extends Omit<TournamentEntryModel, 'createdAt'> {
  createdAt: Date;
}

/**
 * Client-side Match Result (dates as Date objects)
 */
export interface ClientMatchResult extends Omit<MatchResult, 'reportedAt' | 'finalizedAt'> {
  reportedAt?: Date;
  finalizedAt?: Date;
}

/**
 * Client-side Match Result Model (dates as Date objects)
 */
export interface ClientMatchResultModel extends Omit<MatchResultModel, 'reportedAt' | 'finalizedAt'> {
  reportedAt?: Date;
  finalizedAt?: Date;
}

// ============================================
// Zod schemas for validation
// ============================================

export const createTournamentEntrySchema = z.object({
  tournamentId: z.string().uuid("ID de tournoi invalide"),
  entryType: entryTypeSchema,
  teamId: z.string().uuid("ID d'équipe invalide").optional(),
  playerIds: z.array(z.string().uuid("ID de joueur invalide")).min(1),
});

export type CreateTournamentEntryData = z.infer<typeof createTournamentEntrySchema>;
