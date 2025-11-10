import { z } from "zod";
// ============================================
// Enums de base
// ============================================
export const userRoleEnum = [
    "player",
    "tournament_admin",
    "super_admin",
];
export const tournamentModeEnum = ["championship", "bracket"];
export const teamModeEnum = ["static", "flex"];
export const tournamentStatusEnum = [
    "draft",
    "open",
    "ongoing",
    "finished",
];
export const tournamentAdminRoleEnum = ["owner", "co_admin"];
export const matchStatusEnum = [
    "scheduled",
    "reported",
    "pending_confirmation",
    "confirmed",
    "disputed",
    "cancelled",
];
// ============================================
// Schémas Zod pour la validation
// ============================================
export const userRoleSchema = z.enum(userRoleEnum);
export const tournamentModeSchema = z.enum(tournamentModeEnum);
export const teamModeSchema = z.enum(teamModeEnum);
export const tournamentStatusSchema = z.enum(tournamentStatusEnum);
export const tournamentAdminRoleSchema = z.enum(tournamentAdminRoleEnum);
export const matchStatusSchema = z.enum(matchStatusEnum);
