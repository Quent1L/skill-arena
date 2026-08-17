import { z } from "zod";

export const outcomeTypeCountSchema = z
  .object({
    outcomeTypeId: z.string().nullable(),
    outcomeTypeName: z.string().nullable(),
    isDefault: z.boolean(),
    count: z.number(),
  })
  .meta({ id: "OutcomeTypeCount" });

export type OutcomeTypeCount = z.infer<typeof outcomeTypeCountSchema>;

/** Competition ranking (1,1,1,4): entries no criterion separates share a rank. */
export const competitionRankSchema = z
  .object({
    rank: z.number(),
    /** How many entries share this rank, this one included. */
    tiedCount: z.number(),
  })
  .meta({ id: "CompetitionRank" });

export type CompetitionRank = z.infer<typeof competitionRankSchema>;

export const bestTeamEntrySchema = competitionRankSchema
  .extend({
    entryId: z.string(),
    displayName: z.string(),
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    matchesPlayed: z.number(),
    winRate: z.number(),
  })
  .meta({ id: "BestTeamEntry" });

export type BestTeamEntry = z.infer<typeof bestTeamEntrySchema>;

export const momentumDaySchema = z
  .object({
    date: z.string(),
    matchCount: z.number(),
  })
  .meta({ id: "MomentumDay" });

export type MomentumDay = z.infer<typeof momentumDaySchema>;

export const winStreakEntrySchema = z
  .object({
    playerId: z.string(),
    displayName: z.string(),
    shortName: z.string(),
    currentStreak: z.number(),
  })
  .meta({ id: "WinStreakEntry" });

export type WinStreakEntry = z.infer<typeof winStreakEntrySchema>;

export const bestDuoEntrySchema = competitionRankSchema
  .extend({
    playerId: z.string(),
    displayName: z.string(),
    shortName: z.string(),
    wins: z.number(),
    losses: z.number(),
    matchesPlayed: z.number(),
    winRate: z.number(),
  })
  .meta({ id: "BestDuoEntry" });

export type BestDuoEntry = z.infer<typeof bestDuoEntrySchema>;

export const outcomeTypeLeaderSchema = competitionRankSchema
  .extend({
    playerId: z.string(),
    displayName: z.string(),
    shortName: z.string(),
    /** Wins — or losses, depending on which list this entry belongs to */
    count: z.number(),
    /** Matches of this outcome type the player took part in, draws included */
    matchesPlayed: z.number(),
    /** count / matchesPlayed, in percent (0-100), already rounded */
    ratePct: z.number(),
    /** Share of all wins (resp. losses) recorded in this outcome type, in percent, rounded */
    sharePct: z.number(),
  })
  .meta({ id: "OutcomeTypeLeader" });

export type OutcomeTypeLeader = z.infer<typeof outcomeTypeLeaderSchema>;

export const outcomeTypeLeaderboardSchema = z
  .object({
    leaders: z.array(outcomeTypeLeaderSchema),
    /** Names of the players tied with the last shown rank but cut for space */
    omittedNames: z.array(z.string()),
    /** Total cut for space — omittedNames is capped, this is not */
    omittedCount: z.number(),
    /** True when every candidate shares rank 1: no podium, an honour roll instead */
    isFlat: z.boolean(),
    /** Rate boards only: no player reached the match threshold, so the board is unfiltered */
    isLowSample: z.boolean(),
  })
  .meta({ id: "OutcomeTypeLeaderboard" });

export type OutcomeTypeLeaderboard = z.infer<typeof outcomeTypeLeaderboardSchema>;

export const outcomeTypeFunStatSchema = z
  .object({
    outcomeTypeId: z.string(),
    outcomeTypeName: z.string(),
    /** Finalized matches settled with this outcome type */
    totalMatches: z.number(),
    topWinnersByVolume: outcomeTypeLeaderboardSchema,
    topWinnersByRate: outcomeTypeLeaderboardSchema,
    topLosersByVolume: outcomeTypeLeaderboardSchema,
    topLosersByRate: outcomeTypeLeaderboardSchema,
  })
  .meta({ id: "OutcomeTypeFunStat" });

export type OutcomeTypeFunStat = z.infer<typeof outcomeTypeFunStatSchema>;

export const tournamentStatsSchema = z
  .object({
    totalMatches: z.number(),
    totalFinalized: z.number(),
    outcomeDistribution: z.array(outcomeTypeCountSchema),
    bestTeams: z.array(bestTeamEntrySchema),
    momentum: z.array(momentumDaySchema),
    winStreaks: z.array(winStreakEntrySchema),
    lossStreaks: z.array(winStreakEntrySchema),
    invincibleStreaks: z.array(winStreakEntrySchema),
    bestDuoPlayers: z.array(bestDuoEntrySchema),
    bestSoloPlayers: z.array(bestDuoEntrySchema),
    bestAsymmetricSoloPlayers: z.array(bestDuoEntrySchema),
    outcomeTypeFunStats: z.array(outcomeTypeFunStatSchema),
  })
  .meta({ id: "TournamentStats" });

export type TournamentStats = z.infer<typeof tournamentStatsSchema>;
