import { z } from "zod";

// ============================================
// Enums de base
// ============================================

export const userRoleEnum = [
  "player",
  "tournament_admin",
  "super_admin",
] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const tournamentModeEnum = ["championship", "bracket"] as const;
export type TournamentMode = (typeof tournamentModeEnum)[number];

export const teamModeEnum = ["static", "flex"] as const;
export type TeamMode = (typeof teamModeEnum)[number];

export const tournamentStatusEnum = [
  "draft",
  "open",
  "ongoing",
  "finished",
] as const;
export type TournamentStatus = (typeof tournamentStatusEnum)[number];

export const tournamentAdminRoleEnum = ["owner", "co_admin"] as const;
export type TournamentAdminRole = (typeof tournamentAdminRoleEnum)[number];

export const matchStatusEnum = [
  "scheduled",
  "reported",
  "pending_confirmation",
  "confirmed",
  "disputed",
  "cancelled",
  "finalized",
] as const;
export type MatchStatus = (typeof matchStatusEnum)[number];

export const matchFinalizationReasonEnum = [
  "consensus",
  "auto_validation",
  "admin_override",
] as const;
export type MatchFinalizationReason = (typeof matchFinalizationReasonEnum)[number];

export const matchTeamSideEnum = ["A", "B"] as const;
export type MatchTeamSide = (typeof matchTeamSideEnum)[number];

export const outcomeTypeNameEnum = {
  NORMAL: "Normal",
} as const;
export type OutcomeTypeName = (typeof outcomeTypeNameEnum)[keyof typeof outcomeTypeNameEnum];

// ============================================
// Schémas Zod pour la validation
// ============================================

export const userRoleSchema = z.enum(userRoleEnum);
export const tournamentModeSchema = z.enum(tournamentModeEnum);
export const teamModeSchema = z.enum(teamModeEnum);
export const tournamentStatusSchema = z.enum(tournamentStatusEnum);
export const tournamentAdminRoleSchema = z.enum(tournamentAdminRoleEnum);
export const matchStatusSchema = z.enum(matchStatusEnum);
export const matchFinalizationReasonSchema = z.enum(matchFinalizationReasonEnum);
export const matchTeamSideSchema = z.enum(matchTeamSideEnum);
