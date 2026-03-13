import { z } from "zod";
import type { RankTier } from "./enums";

// ============================================
// Types et interfaces pour le mode Ranked
// ============================================

export interface RankedSeasonConfig {
  id: string;
  tournamentId: string;
  baseMmr: number;
  kFactor: number;
  placementMatches: number;
  usePreviousMmr: boolean;
  allowAsymmetricMatches: boolean;
}

export interface PlayerMmr {
  id: string;
  seasonId: string;
  playerId: string;
  currentMmr: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
}

export interface MmrHistoryEntry {
  id: string;
  seasonId: string;
  playerId: string;
  matchId: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  kEffective: number;
  opponentAvgMmr: number;
  isPlacement: boolean;
}

export interface RankBoundaries {
  id: string;
  seasonId: string;
  challengerMax: number;
  strategistMax: number;
  masterMax: number;
  calculatedAt: string;
}

// ============================================
// Types client (dates converties en Date)
// ============================================

export interface ClientPlayerMmr extends PlayerMmr {
  player?: {
    id: string;
    displayName: string;
    shortName: string;
  };
  rank?: RankTier | null;
}

export interface ClientMmrHistoryEntry extends Omit<MmrHistoryEntry, "id"> {
  id: string;
  match?: {
    id: string;
    playedAt: Date;
    status: string;
  };
}

// ============================================
// Schémas Zod pour la validation
// ============================================

export const createRankedSeasonSchema = z.object({
  name: z
    .string({ message: "Le nom est requis" })
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional(),
  disciplineId: z.string({ message: "La discipline est requise" }).uuid("ID de discipline invalide"),
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  minTeamSize: z
    .number({ message: "La taille minimale de l'équipe est requise" })
    .int()
    .min(1, "La taille minimale est 1"),
  maxTeamSize: z
    .number({ message: "La taille maximale de l'équipe est requise" })
    .int()
    .min(1, "La taille minimale est 1"),
  rulesId: z.string().uuid().nullable().optional(),
  // Ranked-specific config
  baseMmr: z.number().int().min(100).max(5000).default(1000),
  kFactor: z.number().int().min(8).max(128).default(32),
  placementMatches: z.number().int().min(1).max(20).default(5),
  usePreviousMmr: z.boolean().default(false),
  allowAsymmetricMatches: z.boolean().default(false),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start < end;
  },
  {
    message: "La date de début doit être antérieure à la date de fin",
    path: ["endDate"],
  }
).refine(
  (data) => data.maxTeamSize >= data.minTeamSize,
  {
    message: "La taille maximale doit être supérieure ou égale à la taille minimale",
    path: ["maxTeamSize"],
  }
);

export const updateRankedSeasonSchema = z.object({
  name: z
    .string()
    .min(3, "Le nom doit contenir au moins 3 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères")
    .optional(),
  description: z
    .string()
    .max(500, "La description ne peut pas dépasser 500 caractères")
    .optional(),
  startDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  rulesId: z.string().uuid().nullable().optional(),
  baseMmr: z.number().int().min(100).max(5000).optional(),
  kFactor: z.number().int().min(8).max(128).optional(),
  placementMatches: z.number().int().min(1).max(20).optional(),
  usePreviousMmr: z.boolean().optional(),
  allowAsymmetricMatches: z.boolean().optional(),
});

// ============================================
// Types inférés des schémas
// ============================================

export type CreateRankedSeasonInput = z.infer<typeof createRankedSeasonSchema>;
export type UpdateRankedSeasonInput = z.infer<typeof updateRankedSeasonSchema>;
