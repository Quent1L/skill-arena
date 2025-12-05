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
]);

export const matchTeamSideEnum = pgEnum("match_team_side", ["A", "B"]);

export const bracketTypeEnum = pgEnum("bracket_type", [
  "winner",
  "loser",
  "grand_final",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "MATCH_INVITE",
  "MATCH_REMINDER",
  "MATCH_VALIDATION",
  "TOURNAMENT_UPDATE",
  "SYSTEM_ALERT",
  "match_created",
]);

export const deviceTypeEnum = pgEnum("device_type", ["WEB", "ANDROID", "IOS"]);

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
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  disciplineId: uuid("discipline_id").references(() => disciplines.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
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
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    matchesPlayed: integer("matches_played").notNull().default(0),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.tournamentId, table.userId)]
);

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  round: integer("round"),
  teamAId: uuid("team_a_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  teamBId: uuid("team_b_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  scoreA: integer("score_a").notNull().default(0),
  scoreB: integer("score_b").notNull().default(0),
  winnerId: uuid("winner_id").references(() => teams.id, {
    onDelete: "set null",
  }),
  winnerSide: matchTeamSideEnum("winner_side"),
  status: matchStatusEnum("status").notNull().default("scheduled"),
  playedAt: timestamp("played_at").notNull().default(new Date()),
  reportedBy: uuid("reported_by").references(() => appUsers.id, {
    onDelete: "set null",
  }),
  reportedAt: timestamp("reported_at"),
  reportProof: text("report_proof"),
  confirmationDeadline: timestamp("confirmation_deadline"),
  finalizedAt: timestamp("finalized_at"),
  finalizedBy: uuid("finalized_by").references(() => appUsers.id, {
    onDelete: "set null",
  }),
  finalizationReason: matchFinalizationReasonEnum("finalization_reason"),
  outcomeTypeId: uuid("outcome_type_id").references(() => outcomeTypes.id, {
    onDelete: "set null",
  }),
  outcomeReasonId: uuid("outcome_reason_id").references(
    () => outcomeReasons.id,
    {
      onDelete: "set null",
    }
  ),
  // Bracket-specific fields
  bracketType: bracketTypeEnum("bracket_type").default("winner"),
  sequence: integer("sequence"),
  // Self-referencing FKs - stored as plain UUIDs to avoid circular type inference issues
  // The actual FK constraints can be added via raw SQL migration if needed
  nextMatchWinId: uuid("next_match_win_id"),
  nextMatchLoseId: uuid("next_match_lose_id"),
  matchPosition: integer("match_position"),
});

export const matchParticipation = pgTable(
  "match_participation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    teamSide: matchTeamSideEnum("team_side").notNull(),
  },
  (table) => [unique().on(table.matchId, table.playerId)]
);

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.matchId, table.playerId)]
);

export const championshipStandings = pgTable("championship_standings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  lastUpdated: timestamp("last_updated")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const disciplines = pgTable("disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

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
  subscriptionData: text("subscription_data"), // Storing JSON as text or use jsonb if preferred
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
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
  tournamentParticipants: many(tournamentParticipants),
  createdTeams: many(teams),
  reportedMatches: many(matches, { relationName: "reportedBy" }),
  finalizedMatches: many(matches, { relationName: "finalizedBy" }),
  matchConfirmations: many(matchConfirmations),
  standings: many(championshipStandings),
  notifications: many(notifications),
  pushDevices: many(userPushDevices),
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
  participants: many(tournamentParticipants),
  teams: many(teams),
  matches: many(matches),
  standings: many(championshipStandings),
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
  })
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
  participants: many(tournamentParticipants),
  matchesAsTeamA: many(matches, { relationName: "teamA" }),
  matchesAsTeamB: many(matches, { relationName: "teamB" }),
  wins: many(matches, { relationName: "winner" }),
}));

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
    team: one(teams, {
      fields: [tournamentParticipants.teamId],
      references: [teams.id],
    }),
  })
);

// @ts-ignore
export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  teamA: one(teams, {
    fields: [matches.teamAId],
    references: [teams.id],
    relationName: "teamA",
  }),
  teamB: one(teams, {
    fields: [matches.teamBId],
    references: [teams.id],
    relationName: "teamB",
  }),
  winner: one(teams, {
    fields: [matches.winnerId],
    references: [teams.id],
    relationName: "winner",
  }),
  reporter: one(appUsers, {
    fields: [matches.reportedBy],
    references: [appUsers.id],
    relationName: "reportedBy",
  }),
  finalizer: one(appUsers, {
    fields: [matches.finalizedBy],
    references: [appUsers.id],
    relationName: "finalizedBy",
  }),
  outcomeType: one(outcomeTypes, {
    fields: [matches.outcomeTypeId],
    references: [outcomeTypes.id],
  }),
  outcomeReason: one(outcomeReasons, {
    fields: [matches.outcomeReasonId],
    references: [outcomeReasons.id],
  }),
  // Bracket relations
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
  participations: many(matchParticipation),
  confirmations: many(matchConfirmations),
}));

export const matchParticipationRelations = relations(
  matchParticipation,
  ({ one }) => ({
    match: one(matches, {
      fields: [matchParticipation.matchId],
      references: [matches.id],
    }),
    player: one(appUsers, {
      fields: [matchParticipation.playerId],
      references: [appUsers.id],
    }),
  })
);

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
    user: one(appUsers, {
      fields: [championshipStandings.userId],
      references: [appUsers.id],
    }),
  })
);

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
  })
);

export const outcomeReasonsRelations = relations(
  outcomeReasons,
  ({ one, many }) => ({
    outcomeType: one(outcomeTypes, {
      fields: [outcomeReasons.outcomeTypeId],
      references: [outcomeTypes.id],
    }),
    matches: many(matches),
  })
);

export const notificationsRelations = relations(
  notifications,
  ({ one, many }) => ({
    user: one(appUsers, {
      fields: [notifications.userId],
      references: [appUsers.id],
    }),
    statuses: many(notificationStatus),
  })
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
  })
);

export const userPushDevicesRelations = relations(
  userPushDevices,
  ({ one }) => ({
    user: one(appUsers, {
      fields: [userPushDevices.userId],
      references: [appUsers.id],
    }),
  })
);
