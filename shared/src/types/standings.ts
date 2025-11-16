// ============================================
// Types et interfaces pour les classements
// ============================================

export interface StandingsEntry {
  id: string;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  scoreDiff: number;
  matchesPlayed: number;
}

export interface StandingsResult {
  standings: StandingsEntry[];
}

