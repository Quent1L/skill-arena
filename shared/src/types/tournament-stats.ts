export interface OutcomeTypeCount {
  outcomeTypeId: string | null
  outcomeTypeName: string | null
  isDefault: boolean
  count: number
}

export interface BestTeamEntry {
  entryId: string
  displayName: string
  wins: number
  losses: number
  draws: number
  matchesPlayed: number
  winRate: number
}

export interface MomentumDay {
  date: string
  matchCount: number
}

export interface WinStreakEntry {
  playerId: string
  displayName: string
  shortName: string
  currentStreak: number
}

export interface BestDuoEntry {
  playerId: string
  displayName: string
  shortName: string
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

export interface OutcomeTypeFunStat {
  outcomeTypeId: string
  outcomeTypeName: string
  topWinner: { playerId: string; displayName: string; shortName: string; count: number } | null
  topLoser: { playerId: string; displayName: string; shortName: string; count: number } | null
}

export interface TournamentStats {
  totalMatches: number
  totalFinalized: number
  outcomeDistribution: OutcomeTypeCount[]
  bestTeams: BestTeamEntry[]
  momentum: MomentumDay[]
  winStreaks: WinStreakEntry[]
  invincibleStreaks: WinStreakEntry[]
  bestDuoPlayers: BestDuoEntry[]
  outcomeTypeFunStats: OutcomeTypeFunStat[]
}
