import { type UserRole } from "./enums";

// ============================================
// Types et interfaces pour les utilisateurs
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface AppUser {
  id: string;
  externalId: string; // Référence vers Better Auth user
  displayName: string;
  role: UserRole;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface UserStats {
  total_matches: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number;
  average_score: number;
  tournaments_participated: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  passwordConfirm?: string;
  name?: string;
  displayName?: string;
}

export interface UserWithStats extends AppUser {
  stats?: UserStats;
}
