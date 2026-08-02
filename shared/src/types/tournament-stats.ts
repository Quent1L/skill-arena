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

export interface OutcomeTypeLeader {
  playerId: string
  displayName: string
  shortName: string
  /** Wins — or losses, depending on which list this entry belongs to */
  count: number
  /** Matches of this outcome type the player took part in, draws included */
  matchesPlayed: number
  /** count / matchesPlayed, in percent (0-100), already rounded */
  ratePct: number
  /** Share of all wins (resp. losses) recorded in this outcome type, in percent, rounded */
  sharePct: number
}

export interface OutcomeTypeFunStat {
  outcomeTypeId: string
  outcomeTypeName: string
  /** Finalized matches settled with this outcome type */
  totalMatches: number
  topWinnersByVolume: OutcomeTypeLeader[]
  topWinnersByRate: OutcomeTypeLeader[]
  topLosersByVolume: OutcomeTypeLeader[]
  topLosersByRate: OutcomeTypeLeader[]
  /** True when no player reached the match threshold, so topWinnersByRate is unfiltered */
  winnersRateIsLowSample: boolean
  /** True when no player reached the match threshold, so topLosersByRate is unfiltered */
  losersRateIsLowSample: boolean
}

export interface TournamentStats {
  totalMatches: number
  totalFinalized: number
  outcomeDistribution: OutcomeTypeCount[]
  bestTeams: BestTeamEntry[]
  momentum: MomentumDay[]
  winStreaks: WinStreakEntry[]
  lossStreaks: WinStreakEntry[]
  invincibleStreaks: WinStreakEntry[]
  bestDuoPlayers: BestDuoEntry[]
  bestSoloPlayers: BestDuoEntry[]
  bestAsymmetricSoloPlayers: BestDuoEntry[]
  outcomeTypeFunStats: OutcomeTypeFunStat[]
}
