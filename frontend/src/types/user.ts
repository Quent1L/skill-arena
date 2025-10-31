/**
 * Types pour la gestion des utilisateurs
 * Basés sur Better Auth
 */

export interface User {
  id: string
  email: string
  name: string
  username?: string
  emailVerified: boolean
  image?: string
  isAdmin: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserStats {
  total_matches: number
  wins: number
  draws: number
  losses: number
  win_rate: number
  average_score: number
  tournaments_participated: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
  username?: string
}
