// ============================================
// Types et interfaces pour les classements
// ============================================

export interface HeadToHeadRecord {
  wins: number;
  draws: number;
  losses: number;
}

export interface StandingsEntry {
  id: string;
  name: string;
  shortName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  scoreDiff: number;
  matchesPlayed: number;
  // Tiebreaker fields
  winLossRatio: number;
  buchholzScore: number;
  victoryQuality: number;
  winRate: number;
  headToHead: Record<string, HeadToHeadRecord>;
}

export interface StandingsResult {
  standings: StandingsEntry[];
}
