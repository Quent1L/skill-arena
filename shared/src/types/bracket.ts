import { z } from "zod";
import {
  type BracketType,
  type SeedingType,
  type BracketRoundType,
  bracketTypeSchema,
  seedingTypeSchema,
  bracketRoundTypeSchema,
} from "./enums";
import type { Match } from "./match";
import type { TournamentEntry } from "./entry";

// ============================================
// Interfaces de base pour les brackets
// ============================================

export interface BracketConfig {
  id: string;
  tournamentId: string;
  bracketType: BracketType;
  seedingType: SeedingType;
  sourceTournamentId?: string;
  totalParticipants: number;
  roundsCount: number;
  hasBronzeMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BracketRound {
  id: string;
  bracketConfigId: string;
  roundNumber: number;
  roundName: string;
  bracketType: BracketRoundType;
  matchesCount: number;
  createdAt: string;
}

export interface BracketSeed {
  id: string;
  bracketConfigId: string;
  entryId: string;
  seedNumber: number;
  seedingScore?: number;
  createdAt: string;
  // Relations
  entry?: TournamentEntry;
}

export interface BracketMatchMetadata {
  id: string;
  matchId: string;
  bracketRoundId: string;
  matchNumber: number;
  winnerToMatchId?: string;
  loserToMatchId?: string;
  isByeMatch: boolean;
  createdAt: string;
}

export interface BracketMatchWithMetadata {
  match: Match;
  metadata: BracketMatchMetadata;
  round: BracketRound;
}

export interface BracketData {
  config: BracketConfig;
  rounds: BracketRound[];
  seeds: BracketSeed[];
  matches: BracketMatchWithMetadata[];
}

// ============================================
// Types pour la génération de bracket
// ============================================

export interface GenerateBracketInput {
  bracketType: BracketType;
  seedingType: SeedingType;
  sourceTournamentId?: string; // Required if seedingType is 'championship_based'
  hasBronzeMatch?: boolean; // Default: false
}

export interface CanGenerateBracketResponse {
  canGenerate: boolean;
  reason?: string;
  matchCount?: number;
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const generateBracketSchema = z
  .object({
    bracketType: bracketTypeSchema,
    seedingType: seedingTypeSchema,
    sourceTournamentId: z.string().uuid().optional(),
    hasBronzeMatch: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      if (data.seedingType === "championship_based" && !data.sourceTournamentId) {
        return false;
      }
      return true;
    },
    {
      message: "sourceTournamentId is required for championship-based seeding",
      path: ["sourceTournamentId"],
    }
  );

export const bracketConfigSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  bracketType: bracketTypeSchema,
  seedingType: seedingTypeSchema,
  sourceTournamentId: z.string().uuid().optional(),
  totalParticipants: z.number().int().positive(),
  roundsCount: z.number().int().positive(),
  hasBronzeMatch: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const bracketRoundSchema = z.object({
  id: z.string().uuid(),
  bracketConfigId: z.string().uuid(),
  roundNumber: z.number().int().min(0),
  roundName: z.string().min(1),
  bracketType: bracketRoundTypeSchema,
  matchesCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export const bracketSeedSchema = z.object({
  id: z.string().uuid(),
  bracketConfigId: z.string().uuid(),
  entryId: z.string().uuid(),
  seedNumber: z.number().int().positive(),
  seedingScore: z.number().int().optional(),
  createdAt: z.string().datetime(),
});

export const bracketMatchMetadataSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  bracketRoundId: z.string().uuid(),
  matchNumber: z.number().int().min(0),
  winnerToMatchId: z.string().uuid().optional(),
  loserToMatchId: z.string().uuid().optional(),
  isByeMatch: z.boolean(),
  createdAt: z.string().datetime(),
});

export const canGenerateBracketResponseSchema = z.object({
  canGenerate: z.boolean(),
  reason: z.string().optional(),
  matchCount: z.number().int().optional(),
});

// ============================================
// Types inférés des schémas
// ============================================

export type GenerateBracketRequestData = z.infer<typeof generateBracketSchema>;
export type CanGenerateBracketResponseData = z.infer<typeof canGenerateBracketResponseSchema>;

// ============================================
// Types pour le frontend (avec dates en Date)
// ============================================

/**
 * Type pour BracketConfig côté frontend - dates converties en Date par xior
 */
export interface ClientBracketConfig extends Omit<BracketConfig, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type pour BracketRound côté frontend
 */
export interface ClientBracketRound extends Omit<BracketRound, 'createdAt'> {
  createdAt: Date;
}

/**
 * Type pour BracketSeed côté frontend
 */
export interface ClientBracketSeed extends Omit<BracketSeed, 'createdAt'> {
  createdAt: Date;
}

/**
 * Type pour BracketMatchMetadata côté frontend
 */
export interface ClientBracketMatchMetadata extends Omit<BracketMatchMetadata, 'createdAt'> {
  createdAt: Date;
}

/**
 * Type pour BracketMatchWithMetadata côté frontend
 */
export interface ClientBracketMatchWithMetadata {
  match: Match; // Match has its own Client type conversion
  metadata: ClientBracketMatchMetadata;
  round: ClientBracketRound;
}

/**
 * Type pour BracketData côté frontend
 */
export interface ClientBracketData {
  config: ClientBracketConfig;
  rounds: ClientBracketRound[];
  seeds: ClientBracketSeed[];
  matches: ClientBracketMatchWithMetadata[];
}
