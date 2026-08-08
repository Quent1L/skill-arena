export interface OutcomeTypeCount {
  outcomeTypeId: string | null
  outcomeTypeName: string | null
  isDefault: boolean
  count: number
}

/** Competition ranking (1,1,1,4): entries no criterion separates share a rank. */
export interface CompetitionRank {
  rank: number
  /** How many entries share this rank, this one included. */
  tiedCount: number
}

export interface BestTeamEntry extends CompetitionRank {
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

export interface BestDuoEntry extends CompetitionRank {
  playerId: string
  displayName: string
  shortName: string
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

export interface OutcomeTypeLeader extends CompetitionRank {
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

export interface OutcomeTypeLeaderboard {
  leaders: OutcomeTypeLeader[]
  /** Names of the players tied with the last shown rank but cut for space */
  omittedNames: string[]
  /** Total cut for space — omittedNames is capped, this is not */
  omittedCount: number
  /** True when every candidate shares rank 1: no podium, an honour roll instead */
  isFlat: boolean
  /** Rate boards only: no player reached the match threshold, so the board is unfiltered */
  isLowSample: boolean
}

export interface OutcomeTypeFunStat {
  outcomeTypeId: string
  outcomeTypeName: string
  /** Finalized matches settled with this outcome type */
  totalMatches: number
  topWinnersByVolume: OutcomeTypeLeaderboard
  topWinnersByRate: OutcomeTypeLeaderboard
  topLosersByVolume: OutcomeTypeLeaderboard
  topLosersByRate: OutcomeTypeLeaderboard
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
