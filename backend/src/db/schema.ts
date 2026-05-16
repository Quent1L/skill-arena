import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  pgEnum,
  date,
  unique,
  primaryKey,
  jsonb,
  varchar,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ********************************************************************
// [Start] Database schema for Better Auth with Drizzle ORM and PostgreSQL
// ***************************************************************
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ********************************************************************
// [End] Database schema for Better Auth with Drizzle ORM and PostgreSQL
// ***************************************************************

// ********************************************************************
// [Start] Invitation codes for account registration
// ***************************************************************

export const invitationCodes = pgTable("invitation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").unique().notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
});

export const invitationUsages = pgTable("invitation_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeId: uuid("code_id")
    .notNull()
    .references(() => invitationCodes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
});

// ********************************************************************
// [End] Invitation codes
// ***************************************************************

// ********************************************************************
// [Start] Skol application tables
// ***************************************************************

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "player",
  "tournament_admin",
  "super_admin",
  "kiosk",
]);

export const tournamentModeEnum = pgEnum("tournament_mode", [
  "championship",
  "bracket",
  "ranked",
]);

export const teamModeEnum = pgEnum("team_mode", ["static", "flex"]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "open",
  "ongoing",
  "finished",
]);

export const tournamentAdminRoleEnum = pgEnum("tournament_admin_role", [
  "owner",
  "co_admin",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "reported",
  "pending_confirmation",
  "confirmed",
  "disputed",
  "cancelled",
  "finalized",
]);

export const matchFinalizationReasonEnum = pgEnum("match_finalization_reason", [
  "consensus",
  "auto_validation",
  "admin_override",
  "trust_score",
]);

export const validationModeEnum = pgEnum("validation_mode", ["auto", "strict", "admin", "none"]);

export const matchTeamSideEnum = pgEnum("match_team_side", ["A", "B"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "MATCH_INVITE",
  "MATCH_REMINDER",
  "MATCH_VALIDATION",
  "TOURNAMENT_UPDATE",
  "SYSTEM_ALERT",
  "match_created",
  "MATCH_SCORE_PROPOSAL",
]);

export const deviceTypeEnum = pgEnum("device_type", ["WEB", "ANDROID", "IOS"]);

export const entryTypeEnum = pgEnum("entry_type", ["PLAYER", "TEAM"]);

export const participantStatusEnum = pgEnum("participant_status", [
  "active",
  "withdrawn",
  "removed",
]);

export const bracketTypeEnum = pgEnum("bracket_type", [
  "single_elimination",
  "double_elimination",
]);

export const seedingTypeEnum = pgEnum("seeding_type", [
  "random",
  "championship_based",
]);

export const bracketRoundTypeEnum = pgEnum("bracket_round_type", [
  "winners",
  "losers",
  "bronze",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.organizationId, t.userId)],
);

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  shortName: text("short_name").notNull(),
  role: userRoleEnum("role").notNull().default("player"),
  trustScoreCount: integer("trust_score_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const gameRules = pgTable("game_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  mode: tournamentModeEnum("mode").notNull(),
  teamMode: teamModeEnum("team_mode").notNull(),
  minTeamSize: integer("min_team_size").notNull(),
  maxTeamSize: integer("max_team_size").notNull(),
  maxMatchesPerPlayer: integer("max_matches_per_player").notNull().default(10),
  maxTimesWithSamePartner: integer("max_times_with_same_partner")
    .notNull()
    .default(2),
  maxTimesWithSameOpponent: integer("max_times_with_same_opponent")
    .notNull()
    .default(2),
  pointPerVictory: integer("point_per_victory").default(3),
  pointPerDraw: integer("point_per_draw").default(1),
  pointPerLoss: integer("point_per_loss").default(0),
  allowDraw: boolean("allow_draw").default(true),
  scoreEnabled: boolean("score_enabled").notNull().default(true),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, {
    onDelete: "set null",
  }),
  rulesId: uuid("rules_id").references(() => gameRules.id, {
    onDelete: "set null",
  }),
  minScore: integer("min_score"),
  maxScore: integer("max_score"),
  validationMode: validationModeEnum("validation_mode").notNull().default("strict"),
  validationTimerHours: integer("validation_timer_hours"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
});

export const tournamentAdmins = pgTable(
  "tournament_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: tournamentAdminRoleEnum("role").notNull().default("co_admin"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.userId)],
);

// ********************************************************************
// Tournament Participants - User registration/enrollment in tournaments
// Tracks who CAN play (vs tournamentEntries which tracks who DID play)
// ***************************************************************

export const tournamentParticipants = pgTable(
  "tournament_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: participantStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.userId)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.name)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.teamId, table.userId)],
);

// ********************************************************************
// [Start] New generic entry-based tables (replaces tournamentParticipants)
// ***************************************************************

export const tournamentEntries = pgTable("tournament_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  entryType: entryTypeEnum("entry_type").notNull(),
  teamId: uuid("team_id").references(() => teams.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournamentEntryPlayers = pgTable(
  "tournament_entry_players",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
  },
  (table) => [unique().on(table.entryId, table.playerId)],
);

// ********************************************************************
// [End] New generic entry-based tables
// ***************************************************************

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  status: matchStatusEnum("status").notNull().default("scheduled"),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  confirmationDeadline: timestamp("confirmation_deadline", { withTimezone: true }),
  outcomeTypeId: uuid("outcome_type_id").references(() => outcomeTypes.id, {
    onDelete: "set null",
  }),
  outcomeReasonId: uuid("outcome_reason_id").references(
    () => outcomeReasons.id,
    {
      onDelete: "set null",
    },
  ),
  winnerSide: varchar("winner_side", { length: 1 }),
  createdBy: uuid("created_by").references(() => appUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ********************************************************************
// [Start] New match sides and results tables
// ***************************************************************

export const matchSides = pgTable(
  "match_sides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    score: integer("score"),
    pointsAwarded: integer("points_awarded").default(0),
  },
  (table) => [unique().on(table.matchId, table.entryId)],
);

export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by").references(() => appUsers.id, {
    onDelete: "set null",
  }),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  reportProof: text("report_proof"),
  finalizedBy: uuid("finalized_by").references(() => appUsers.id, {
    onDelete: "set null",
  }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  finalizationReason: matchFinalizationReasonEnum("finalization_reason"),
});

export const matchPlayerPoints = pgTable(
  "match_player_points",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    pointsAwarded: integer("points_awarded").notNull(),
    countsForRanking: boolean("counts_for_ranking").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

// ********************************************************************
// [End] New match sides and results tables
// ***************************************************************

export const matchConfirmations = pgTable(
  "match_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    isContested: boolean("is_contested").notNull().default(false),
    contestationReason: text("contestation_reason"),
    contestationProof: text("contestation_proof"),
    proposedScoreA: integer("proposed_score_a"),
    proposedScoreB: integer("proposed_score_b"),
    proposedWinner: text("proposed_winner"),
    proposedOutcomeTypeId: uuid("proposed_outcome_type_id").references(
      () => outcomeTypes.id,
      { onDelete: "set null" },
    ),
    proposedOutcomeReasonId: uuid("proposed_outcome_reason_id").references(
      () => outcomeReasons.id,
      { onDelete: "set null" },
    ),
    sidePosition: integer("side_position"),
    isPostFinalization: boolean("is_post_finalization").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique("match_confirmations_match_id_player_id_post_unique").on(table.matchId, table.playerId, table.isPostFinalization)],
);

// ********************************************************************
// [Start] Bracket tournament tables
// ***************************************************************

export const bracketConfigs = pgTable("bracket_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .unique()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  bracketType: bracketTypeEnum("bracket_type").notNull(),
  seedingType: seedingTypeEnum("seeding_type").notNull(),
  sourceTournamentId: uuid("source_tournament_id").references(
    () => tournaments.id,
    { onDelete: "set null" },
  ),
  totalParticipants: integer("total_participants").notNull(),
  roundsCount: integer("rounds_count").notNull(),
  hasBronzeMatch: boolean("has_bronze_match").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const bracketRounds = pgTable(
  "bracket_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bracketConfigId: uuid("bracket_config_id")
      .notNull()
      .references(() => bracketConfigs.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    roundName: text("round_name").notNull(),
    bracketType: bracketRoundTypeEnum("bracket_type").notNull(),
    matchesCount: integer("matches_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.bracketConfigId, table.roundNumber, table.bracketType),
  ],
);

export const bracketSeeds = pgTable(
  "bracket_seeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bracketConfigId: uuid("bracket_config_id")
      .notNull()
      .references(() => bracketConfigs.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),
    seedNumber: integer("seed_number").notNull(),
    seedingScore: integer("seeding_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.bracketConfigId, table.entryId),
    unique().on(table.bracketConfigId, table.seedNumber),
  ],
);

export const bracketMatchMetadata = pgTable(
  "bracket_match_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .unique()
      .references(() => matches.id, { onDelete: "cascade" }),
    bracketRoundId: uuid("bracket_round_id")
      .notNull()
      .references(() => bracketRounds.id, { onDelete: "cascade" }),
    matchNumber: integer("match_number").notNull(),
    winnerToMatchId: uuid("winner_to_match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    loserToMatchId: uuid("loser_to_match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    isByeMatch: boolean("is_bye_match").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.bracketRoundId, table.matchNumber)],
);

// ********************************************************************
// [End] Bracket tournament tables
// ***************************************************************

// ********************************************************************
// [Start] Ranked season tables
// ***************************************************************

export const rankedSeasonConfigs = pgTable("ranked_season_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .unique()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  baseMmr: integer("base_mmr").notNull().default(1000),
  kFactor: integer("k_factor").notNull().default(32),
  placementMatches: integer("placement_matches").notNull().default(5),
  usePreviousMmr: boolean("use_previous_mmr").notNull().default(false),
  allowAsymmetricMatches: boolean("allow_asymmetric_matches")
    .notNull()
    .default(false),
  sourceTierSeasonId: uuid("source_tier_season_id").references(() => tournaments.id, {
    onDelete: "set null",
  }),
});

export const playerMmr = pgTable(
  "player_mmr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    currentMmr: integer("current_mmr").notNull(),
    matchesPlayed: integer("matches_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    winStreak: integer("win_streak").notNull().default(0),
    maxWinStreak: integer("max_win_streak").notNull().default(0),
  },
  (table) => [unique().on(table.seasonId, table.playerId)],
);

export const mmrHistory = pgTable(
  "mmr_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    mmrBefore: integer("mmr_before").notNull(),
    mmrAfter: integer("mmr_after").notNull(),
    mmrDelta: integer("mmr_delta").notNull(),
    kEffective: real("k_effective").notNull(),
    opponentAvgMmr: integer("opponent_avg_mmr").notNull(),
    isPlacement: boolean("is_placement").notNull().default(false),
  },
  (table) => [unique().on(table.seasonId, table.playerId, table.matchId)],
);

export const rankTiers = pgTable(
  "rank_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    percentile: real("percentile").notNull(),
    minMmr: integer("min_mmr").notNull(),
    subRanks: integer("sub_ranks").notNull().default(1),
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.seasonId, table.level)],
);

export const mmrAnimationEventTypeEnum = pgEnum("mmr_animation_event_type", [
  "provisional",
  "official",
]);

export const mmrAnimationEvents = pgTable(
  "mmr_animation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    eventType: mmrAnimationEventTypeEnum("event_type").notNull(),
    mmrBefore: integer("mmr_before").notNull(),
    mmrAfter: integer("mmr_after").notNull(),
    mmrDelta: integer("mmr_delta").notNull(),
    tierBeforeLevel: integer("tier_before_level"),
    tierAfterLevel: integer("tier_after_level"),
    tierBeforeName: text("tier_before_name"),
    tierAfterName: text("tier_after_name"),
    rankChanged: boolean("rank_changed").notNull().default(false),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.playerId, table.seasonId, table.matchId, table.eventType),
  ],
);

// ********************************************************************
// [End] Ranked season tables
// ***************************************************************

export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  scoreInstructions: text("score_instructions"),
});

export const outcomeTypes = pgTable("outcome_types", {
  id: uuid("id").primaryKey().defaultRandom(),

  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  scoreCountsForMmr: boolean("score_counts_for_mmr").notNull().default(true),
  points: integer("points").notNull().default(3),
});

export const outcomeReasons = pgTable("outcome_reasons", {
  id: uuid("id").primaryKey().defaultRandom(),

  outcomeTypeId: uuid("outcome_type_id")
    .notNull()
    .references(() => outcomeTypes.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  titleKey: text("title_key").notNull(),
  messageKey: text("message_key").notNull(),
  translationParams: jsonb("translation_params"),
  actionUrl: text("action_url"),
  requiresAction: boolean("requires_action").notNull().default(false),
  matchId: uuid("match_id").references(() => matches.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  resentCount: integer("resent_count").notNull().default(0),
  nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }),
});

export const notificationStatus = pgTable(
  "notification_status",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    read: boolean("read").notNull().default(false),
    actionCompleted: boolean("action_completed").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    actionCompletedAt: timestamp("action_completed_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.notificationId, table.userId)],
);

export const userPushDevices = pgTable("user_push_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  deviceType: deviceTypeEnum("device_type").notNull(),
  subscriptionEndpoint: text("subscription_endpoint").notNull(),
  subscriptionData: text("subscription_data"), // Storing JSON as text or use jsonb if preferred
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const appUsersRelations = relations(appUsers, ({ one, many }) => ({
  externalUser: one(user, {
    fields: [appUsers.externalId],
    references: [user.id],
  }),
  createdTournaments: many(tournaments),
  tournamentAdmins: many(tournamentAdmins),
  createdTeams: many(teams),
  teamMemberships: many(teamMembers),
  tournamentEntryPlayers: many(tournamentEntryPlayers),
  matchConfirmations: many(matchConfirmations),
  notifications: many(notifications),
  pushDevices: many(userPushDevices),
  reportedMatches: many(matchResults, { relationName: "reportedBy" }),
  finalizedMatches: many(matchResults, { relationName: "finalizedBy" }),
  createdInvitationCodes: many(invitationCodes),
  createdGameRules: many(gameRules),
  playerMmrs: many(playerMmr),
  matchPlayerPoints: many(matchPlayerPoints),
  playerComputedData: many(playerComputedData),
  organizationMemberships: many(organizationMembers),
  createdOrganizations: many(organizations),
  mmrAnimationEvents: many(mmrAnimationEvents),
}));

export const gameRulesRelations = relations(gameRules, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [gameRules.createdBy],
    references: [appUsers.id],
  }),
  tournaments: many(tournaments),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [tournaments.createdBy],
    references: [appUsers.id],
  }),
  discipline: one(disciplines, {
    fields: [tournaments.disciplineId],
    references: [disciplines.id],
  }),
  rules: one(gameRules, {
    fields: [tournaments.rulesId],
    references: [gameRules.id],
  }),
  admins: many(tournamentAdmins),
  participants: many(tournamentParticipants),
  entries: many(tournamentEntries),
  teams: many(teams),
  matches: many(matches),
  bracketConfig: one(bracketConfigs, {
    fields: [tournaments.id],
    references: [bracketConfigs.tournamentId],
  }),
  sourcedBrackets: many(bracketConfigs, { relationName: "sourceTournament" }),
  rankedConfig: one(rankedSeasonConfigs, {
    fields: [tournaments.id],
    references: [rankedSeasonConfigs.tournamentId],
  }),
  rankTiers: many(rankTiers),
  playerMmrs: many(playerMmr),
  computedData: many(computedData),
  organization: one(organizations, {
    fields: [tournaments.organizationId],
    references: [organizations.id],
  }),
}));

export const tournamentAdminsRelations = relations(
  tournamentAdmins,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentAdmins.tournamentId],
      references: [tournaments.id],
    }),
    user: one(appUsers, {
      fields: [tournamentAdmins.userId],
      references: [appUsers.id],
    }),
  }),
);

export const tournamentParticipantsRelations = relations(
  tournamentParticipants,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentParticipants.tournamentId],
      references: [tournaments.id],
    }),
    user: one(appUsers, {
      fields: [tournamentParticipants.userId],
      references: [appUsers.id],
    }),
  }),
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [teams.tournamentId],
    references: [tournaments.id],
  }),
  creator: one(appUsers, {
    fields: [teams.createdBy],
    references: [appUsers.id],
  }),
  entries: many(tournamentEntries),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(appUsers, {
    fields: [teamMembers.userId],
    references: [appUsers.id],
  }),
}));

// ********************************************************************
// [Start] New entry-based relations
// ***************************************************************

export const tournamentEntriesRelations = relations(
  tournamentEntries,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentEntries.tournamentId],
      references: [tournaments.id],
    }),
    team: one(teams, {
      fields: [tournamentEntries.teamId],
      references: [teams.id],
    }),
    players: many(tournamentEntryPlayers),
    matchSides: many(matchSides),
  }),
);

export const tournamentEntryPlayersRelations = relations(
  tournamentEntryPlayers,
  ({ one }) => ({
    entry: one(tournamentEntries, {
      fields: [tournamentEntryPlayers.entryId],
      references: [tournamentEntries.id],
    }),
    player: one(appUsers, {
      fields: [tournamentEntryPlayers.playerId],
      references: [appUsers.id],
    }),
  }),
);

// ********************************************************************
// [End] New entry-based relations
// ***************************************************************

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  outcomeType: one(outcomeTypes, {
    fields: [matches.outcomeTypeId],
    references: [outcomeTypes.id],
  }),
  outcomeReason: one(outcomeReasons, {
    fields: [matches.outcomeReasonId],
    references: [outcomeReasons.id],
  }),
  sides: many(matchSides),
  playerPoints: many(matchPlayerPoints),
  result: one(matchResults, {
    fields: [matches.id],
    references: [matchResults.matchId],
  }),
  confirmations: many(matchConfirmations),
  bracketMetadata: one(bracketMatchMetadata, {
    fields: [matches.id],
    references: [bracketMatchMetadata.matchId],
  }),
}));

// ********************************************************************
// [Start] New match-related relations
// ***************************************************************

export const matchSidesRelations = relations(matchSides, ({ one }) => ({
  match: one(matches, {
    fields: [matchSides.matchId],
    references: [matches.id],
  }),
  entry: one(tournamentEntries, {
    fields: [matchSides.entryId],
    references: [tournamentEntries.id],
  }),
}));

export const matchResultsRelations = relations(matchResults, ({ one }) => ({
  match: one(matches, {
    fields: [matchResults.matchId],
    references: [matches.id],
  }),
  reporter: one(appUsers, {
    fields: [matchResults.reportedBy],
    references: [appUsers.id],
    relationName: "reportedBy",
  }),
  finalizer: one(appUsers, {
    fields: [matchResults.finalizedBy],
    references: [appUsers.id],
    relationName: "finalizedBy",
  }),
}));

export const matchPlayerPointsRelations = relations(
  matchPlayerPoints,
  ({ one }) => ({
    match: one(matches, {
      fields: [matchPlayerPoints.matchId],
      references: [matches.id],
    }),
    player: one(appUsers, {
      fields: [matchPlayerPoints.playerId],
      references: [appUsers.id],
    }),
  }),
);

// ********************************************************************
// [End] New match-related relations
// ***************************************************************

export const matchConfirmationsRelations = relations(
  matchConfirmations,
  ({ one }) => ({
    match: one(matches, {
      fields: [matchConfirmations.matchId],
      references: [matches.id],
    }),
    player: one(appUsers, {
      fields: [matchConfirmations.playerId],
      references: [appUsers.id],
    }),
    proposedOutcomeType: one(outcomeTypes, {
      fields: [matchConfirmations.proposedOutcomeTypeId],
      references: [outcomeTypes.id],
    }),
    proposedOutcomeReason: one(outcomeReasons, {
      fields: [matchConfirmations.proposedOutcomeReasonId],
      references: [outcomeReasons.id],
    }),
  }),
);

// ********************************************************************
// [Start] Bracket tournament relations
// ***************************************************************

export const bracketConfigsRelations = relations(
  bracketConfigs,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [bracketConfigs.tournamentId],
      references: [tournaments.id],
    }),
    sourceTournament: one(tournaments, {
      fields: [bracketConfigs.sourceTournamentId],
      references: [tournaments.id],
      relationName: "sourceTournament",
    }),
    rounds: many(bracketRounds),
    seeds: many(bracketSeeds),
  }),
);

export const bracketRoundsRelations = relations(
  bracketRounds,
  ({ one, many }) => ({
    bracketConfig: one(bracketConfigs, {
      fields: [bracketRounds.bracketConfigId],
      references: [bracketConfigs.id],
    }),
    matchMetadata: many(bracketMatchMetadata),
  }),
);

export const bracketSeedsRelations = relations(bracketSeeds, ({ one }) => ({
  bracketConfig: one(bracketConfigs, {
    fields: [bracketSeeds.bracketConfigId],
    references: [bracketConfigs.id],
  }),
  entry: one(tournamentEntries, {
    fields: [bracketSeeds.entryId],
    references: [tournamentEntries.id],
  }),
}));

export const bracketMatchMetadataRelations = relations(
  bracketMatchMetadata,
  ({ one }) => ({
    match: one(matches, {
      fields: [bracketMatchMetadata.matchId],
      references: [matches.id],
    }),
    bracketRound: one(bracketRounds, {
      fields: [bracketMatchMetadata.bracketRoundId],
      references: [bracketRounds.id],
    }),
    winnerToMatch: one(matches, {
      fields: [bracketMatchMetadata.winnerToMatchId],
      references: [matches.id],
      relationName: "winnerToMatch",
    }),
    loserToMatch: one(matches, {
      fields: [bracketMatchMetadata.loserToMatchId],
      references: [matches.id],
      relationName: "loserToMatch",
    }),
  }),
);

// ********************************************************************
// [End] Bracket tournament relations
// ***************************************************************

// ********************************************************************
// [Start] Ranked season relations
// ***************************************************************

export const rankedSeasonConfigsRelations = relations(
  rankedSeasonConfigs,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [rankedSeasonConfigs.tournamentId],
      references: [tournaments.id],
    }),
  }),
);

export const playerMmrRelations = relations(playerMmr, ({ one }) => ({
  season: one(tournaments, {
    fields: [playerMmr.seasonId],
    references: [tournaments.id],
  }),
  player: one(appUsers, {
    fields: [playerMmr.playerId],
    references: [appUsers.id],
  }),
}));

export const mmrHistoryRelations = relations(mmrHistory, ({ one }) => ({
  season: one(tournaments, {
    fields: [mmrHistory.seasonId],
    references: [tournaments.id],
  }),
  player: one(appUsers, {
    fields: [mmrHistory.playerId],
    references: [appUsers.id],
  }),
  match: one(matches, {
    fields: [mmrHistory.matchId],
    references: [matches.id],
  }),
}));

export const rankTiersRelations = relations(
  rankTiers,
  ({ one }) => ({
    season: one(tournaments, {
      fields: [rankTiers.seasonId],
      references: [tournaments.id],
    }),
  }),
);

// ********************************************************************
// [End] Ranked season relations
// ***************************************************************

export const disciplinesRelations = relations(disciplines, ({ many }) => ({
  outcomeTypes: many(outcomeTypes),
  tournaments: many(tournaments),
}));

export const outcomeTypesRelations = relations(
  outcomeTypes,
  ({ one, many }) => ({
    discipline: one(disciplines, {
      fields: [outcomeTypes.disciplineId],
      references: [disciplines.id],
    }),
    outcomeReasons: many(outcomeReasons),
    matches: many(matches),
  }),
);

export const outcomeReasonsRelations = relations(
  outcomeReasons,
  ({ one, many }) => ({
    outcomeType: one(outcomeTypes, {
      fields: [outcomeReasons.outcomeTypeId],
      references: [outcomeTypes.id],
    }),
    matches: many(matches),
  }),
);

export const notificationsRelations = relations(
  notifications,
  ({ one, many }) => ({
    user: one(appUsers, {
      fields: [notifications.userId],
      references: [appUsers.id],
    }),
    match: one(matches, {
      fields: [notifications.matchId],
      references: [matches.id],
    }),
    statuses: many(notificationStatus),
  }),
);

export const notificationStatusRelations = relations(
  notificationStatus,
  ({ one }) => ({
    notification: one(notifications, {
      fields: [notificationStatus.notificationId],
      references: [notifications.id],
    }),
    user: one(appUsers, {
      fields: [notificationStatus.userId],
      references: [appUsers.id],
    }),
  }),
);

export const userPushDevicesRelations = relations(
  userPushDevices,
  ({ one }) => ({
    user: one(appUsers, {
      fields: [userPushDevices.userId],
      references: [appUsers.id],
    }),
  }),
);

export const invitationCodesRelations = relations(
  invitationCodes,
  ({ one, many }) => ({
    creator: one(appUsers, {
      fields: [invitationCodes.createdBy],
      references: [appUsers.id],
    }),
    usages: many(invitationUsages),
    organization: one(organizations, {
      fields: [invitationCodes.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [organizations.createdBy],
    references: [appUsers.id],
  }),
  members: many(organizationMembers),
  tournaments: many(tournaments),
  invitationCodes: many(invitationCodes),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(appUsers, {
    fields: [organizationMembers.userId],
    references: [appUsers.id],
  }),
}));

export const invitationUsagesRelations = relations(
  invitationUsages,
  ({ one }) => ({
    code: one(invitationCodes, {
      fields: [invitationUsages.codeId],
      references: [invitationCodes.id],
    }),
    user: one(user, {
      fields: [invitationUsages.userId],
      references: [user.id],
    }),
  }),
);

export const computedData = pgTable(
  "computed_data",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tournamentId, t.key] })],
);

export const computedDataRelations = relations(computedData, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [computedData.tournamentId],
    references: [tournaments.id],
  }),
}));

export const playerComputedData = pgTable(
  "player_computed_data",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.key] })],
);

export const mmrAnimationEventsRelations = relations(mmrAnimationEvents, ({ one }) => ({
  player: one(appUsers, {
    fields: [mmrAnimationEvents.playerId],
    references: [appUsers.id],
  }),
  season: one(tournaments, {
    fields: [mmrAnimationEvents.seasonId],
    references: [tournaments.id],
  }),
  match: one(matches, {
    fields: [mmrAnimationEvents.matchId],
    references: [matches.id],
  }),
}));

export const playerComputedDataRelations = relations(playerComputedData, ({ one }) => ({
  player: one(appUsers, {
    fields: [playerComputedData.playerId],
    references: [appUsers.id],
  }),
}));
