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
]);

// Table app_users
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

// Table tournaments
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
  createdBy: uuid("created_by")
    .notNull()
    .references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table tournament_admins
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

// Table teams
// Table teams
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hash: text("hash").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.tournamentId, table.name),
    unique().on(table.tournamentId, table.hash),
  ]
);

// Table tournament_participants
// Table tournament_participants
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

// Table matches
// Table matches
export const matches = pgTable(
  "matches",
  {
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
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winnerId: uuid("winner_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    reportedBy: uuid("reported_by").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    reportedAt: timestamp("reported_at"),
    confirmationBy: uuid("confirmation_by").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    confirmationAt: timestamp("confirmation_at"),
    reportProof: text("report_proof"),
  },
  (table) => [unique().on(table.tournamentId, table.teamAId, table.teamBId)]
);

// Table championship_standings
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

// Relations
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
  confirmedMatches: many(matches, { relationName: "confirmedBy" }),
  standings: many(championshipStandings),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [tournaments.createdBy],
    references: [appUsers.id],
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

export const matchesRelations = relations(matches, ({ one }) => ({
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
  confirmer: one(appUsers, {
    fields: [matches.confirmationBy],
    references: [appUsers.id],
    relationName: "confirmedBy",
  }),
}));

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

// ********************************************************************
// [End] Skill Arena application tables
// ***************************************************************
