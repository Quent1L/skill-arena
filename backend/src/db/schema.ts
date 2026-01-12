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
  jsonb,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
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
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ********************************************************************
// [End] Database schema for Better Auth with Drizzle ORM and PostgreSQL
// ***************************************************************

// ********************************************************************
// [Start] Skill Arena application tables
// ***************************************************************

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "player",
  "tournament_admin",
  "super_admin",
]);

export const tournamentModeEnum = pgEnum("tournament_mode", [
  "championship",
  "bracket",
  "hybrid",
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
  "ongoing",
  "completed",
  "cancelled",
]);

export const bracketTypeEnum = pgEnum("bracket_type", [
  "winner",
  "loser",
  "grand_final",
]);

export const entryTypeEnum = pgEnum("entry_type", ["PLAYER", "TEAM"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "MATCH_INVITE",
  "MATCH_REMINDER",
  "MATCH_VALIDATION",
  "TOURNAMENT_UPDATE",
  "SYSTEM_ALERT",
  "match_created",
]);

export const deviceTypeEnum = pgEnum("device_type", ["WEB", "ANDROID", "IOS"]);

// Users
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("player"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Disciplines
export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  maxParticipantsPerMatch: integer("max_participants_per_match").notNull(),
  supportsTeams: boolean("supports_teams").notNull().default(false),
  supportsDraw: boolean("supports_draw").notNull().default(false),
  usesRanking: boolean("uses_ranking").notNull().default(false),
  supportsMultiGames: boolean("supports_multi_games").notNull().default(false),
});

export const scoringRules = pgTable(
  "scoring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disciplineId: uuid("discipline_id")
      .notNull()
      .references(() => disciplines.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    points: integer("points").notNull(),
  },
  (table) => [unique().on(table.disciplineId, table.position)]
);

// Tournaments
export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id),
  mode: tournamentModeEnum("mode").notNull(),
  teamMode: teamModeEnum("team_mode").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.userId)]
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.name)]
);

// Participants (Entries)
export const tournamentEntries = pgTable(
  "tournament_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    entryType: entryTypeEnum("entry_type").notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  }
);

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
  (table) => [
    // Composite Primary Key equivalent
    unique().on(table.entryId, table.playerId),
  ]
);

// Stages
export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stageType: text("stage_type").notNull(), // group, bracket, final
  settings: jsonb("settings").notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  groupNumber: integer("group_number").notNull(),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
});

// Matches
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  roundId: uuid("round_id").references(() => rounds.id, { onDelete: "cascade" }),

  matchNumber: integer("match_number").notNull(),
  scheduledAt: timestamp("scheduled_at"),

  status: matchStatusEnum("status").notNull().default("scheduled"),

  // Bracket graph
  bracketType: bracketTypeEnum("bracket_type"),
  // Self-referencing keys must be handled carefully. Drizzle doesn't strictly require referencing same table in definition if it causes circular issues in type inference, but usually it works with arrow function.
  nextMatchWinId: uuid("next_match_win_id"),
  nextMatchLoseId: uuid("next_match_lose_id"),

  createdAt: timestamp("created_at").defaultNow(),
});

// While we can try to add foreign keys for nextMatchWinId, specific recursive relations sometimes need explicit `foreignKey` definitions or just kept as uuid in definition and handled in relations/migration. leaving as uuid for now to match the simplicity and avoid circular deps in definition.

export const matchSides = pgTable(
  "match_sides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),

    position: integer("position").notNull(), // 1, 2, or ranking
    score: integer("score"),
    pointsAwarded: integer("points_awarded"),
  },
  (table) => [unique().on(table.matchId, table.entryId)]
);

export const matchGames = pgTable(
  "match_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    gameNumber: integer("game_number").notNull(),
  },
  (table) => [unique().on(table.matchId, table.gameNumber)]
);

export const matchGameSides = pgTable(
  "match_game_sides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchGameId: uuid("match_game_id")
      .notNull()
      .references(() => matchGames.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    score: integer("score"),
  },
  (table) => [unique().on(table.matchGameId, table.entryId)]
);

// Validation / Outcome
export const outcomeTypes = pgTable("outcome_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  disciplineId: uuid("discipline_id")
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const outcomeReasons = pgTable("outcome_reasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  outcomeTypeId: uuid("outcome_type_id")
    .notNull()
    .references(() => outcomeTypes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by").references(() => appUsers.id),
  reportedAt: timestamp("reported_at"),
  finalizedBy: uuid("finalized_by").references(() => appUsers.id),
  finalizedAt: timestamp("finalized_at"),

  outcomeTypeId: uuid("outcome_type_id").references(() => outcomeTypes.id),
  outcomeReasonId: uuid("outcome_reason_id").references(
    () => outcomeReasons.id
  ),
});

export const matchConfirmations = pgTable(
  "match_confirmations",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),

    isConfirmed: boolean("is_confirmed").default(false),
    isContested: boolean("is_contested").default(false),
    contestationReason: text("contestation_reason"),
  },
  (table) => [
    // Composite Primary Key equivalent
    unique().on(table.matchId, table.playerId),
  ]
);

export const championshipStandings = pgTable(
  "championship_standings",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => tournamentEntries.id, { onDelete: "cascade" }),

    points: integer("points").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    matchesPlayed: integer("matches_played").notNull().default(0),
  },
  (table) => [
    // Composite Primary Key equivalent
    unique().on(table.tournamentId, table.entryId),
  ]
);

// Notifications & Devices (Keep existing logic if not conflicting, or simplify as per requirements)
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  pushedAt: timestamp("pushed_at"),
  resentCount: integer("resent_count").notNull().default(0),
  nextReminderAt: timestamp("next_reminder_at"),
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
    readAt: timestamp("read_at"),
    actionCompletedAt: timestamp("action_completed_at"),
  },
  (table) => [unique().on(table.notificationId, table.userId)]
);

export const userPushDevices = pgTable("user_push_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  deviceType: deviceTypeEnum("device_type").notNull(),
  subscriptionEndpoint: text("subscription_endpoint").notNull(),
  subscriptionData: text("subscription_data"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Relations

export const appUsersRelations = relations(appUsers, ({ one, many }) => ({
  externalUser: one(user, {
    fields: [appUsers.externalId],
    references: [user.id],
  }),
  createdTournaments: many(tournaments),
  tournamentAdmins: many(tournamentAdmins),
  createdTeams: many(teams),
  notifications: many(notifications),
  pushDevices: many(userPushDevices),
  // Removed direct relations to matches as they now go through entries mostly, or reporting slightly changed
  // But matchResults has reportedBy
}));

export const disciplinesRelations = relations(disciplines, ({ many }) => ({
  scoringRules: many(scoringRules),
  tournaments: many(tournaments),
  outcomeTypes: many(outcomeTypes),
}));

export const scoringRulesRelations = relations(scoringRules, ({ one }) => ({
  discipline: one(disciplines, {
    fields: [scoringRules.disciplineId],
    references: [disciplines.id],
  }),
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
  admins: many(tournamentAdmins),
  entries: many(tournamentEntries),
  teams: many(teams),
  stages: many(stages),
  matches: many(matches),
  standings: many(championshipStandings),
}));

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
    standings: many(championshipStandings),
  })
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
  })
);

export const stagesRelations = relations(stages, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [stages.tournamentId],
    references: [tournaments.id],
  }),
  groups: many(groups),
  rounds: many(rounds),
  matches: many(matches),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  stage: one(stages, {
    fields: [groups.stageId],
    references: [stages.id],
  }),
  rounds: many(rounds),
  matches: many(matches),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  stage: one(stages, {
    fields: [rounds.stageId],
    references: [stages.id],
  }),
  group: one(groups, {
    fields: [rounds.groupId],
    references: [groups.id],
  }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  stage: one(stages, {
    fields: [matches.stageId],
    references: [stages.id],
  }),
  group: one(groups, {
    fields: [matches.groupId],
    references: [groups.id],
  }),
  round: one(rounds, {
    fields: [matches.roundId],
    references: [rounds.id],
  }),
  sides: many(matchSides),
  games: many(matchGames),
  result: one(matchResults, {
    fields: [matches.id],
    references: [matchResults.matchId],
  }),
  confirmations: many(matchConfirmations),
  nextMatchWin: one(matches, {
    fields: [matches.nextMatchWinId],
    references: [matches.id],
    relationName: "nextMatchWin",
  }),
  nextMatchLose: one(matches, {
    fields: [matches.nextMatchLoseId],
    references: [matches.id],
    relationName: "nextMatchLose",
  }),
}));

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

export const matchGamesRelations = relations(matchGames, ({ one, many }) => ({
  match: one(matches, {
    fields: [matchGames.matchId],
    references: [matches.id],
  }),
  sides: many(matchGameSides),
}));

export const matchGameSidesRelations = relations(matchGameSides, ({ one }) => ({
  game: one(matchGames, {
    fields: [matchGameSides.matchGameId],
    references: [matchGames.id],
  }),
  entry: one(tournamentEntries, {
    fields: [matchGameSides.entryId],
    references: [tournamentEntries.id],
  }),
}));

export const matchResultsRelations = relations(matchResults, ({ one }) => ({
  match: one(matches, {
    fields: [matchResults.matchId],
    references: [matches.id],
  }),
  reportedBy: one(appUsers, {
    fields: [matchResults.reportedBy],
    references: [appUsers.id],
  }),
  finalizedBy: one(appUsers, {
    fields: [matchResults.finalizedBy],
    references: [appUsers.id],
  }),
  outcomeType: one(outcomeTypes, {
    fields: [matchResults.outcomeTypeId],
    references: [outcomeTypes.id],
  }),
  outcomeReason: one(outcomeReasons, {
    fields: [matchResults.outcomeReasonId],
    references: [outcomeReasons.id],
  }),
}));

export const outcomeTypesRelations = relations(
  outcomeTypes,
  ({ one, many }) => ({
    discipline: one(disciplines, {
      fields: [outcomeTypes.disciplineId],
      references: [disciplines.id],
    }),
    possibleReasons: many(outcomeReasons),
  })
);

export const outcomeReasonsRelations = relations(outcomeReasons, ({ one }) => ({
  outcomeType: one(outcomeTypes, {
    fields: [outcomeReasons.outcomeTypeId],
    references: [outcomeTypes.id],
  }),
}));

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
  })
);

export const championshipStandingsRelations = relations(
  championshipStandings,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [championshipStandings.tournamentId],
      references: [tournaments.id],
    }),
    entry: one(tournamentEntries, {
      fields: [championshipStandings.entryId],
      references: [tournamentEntries.id],
    }),
  })
);
