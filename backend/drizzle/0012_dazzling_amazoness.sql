CREATE TYPE "public"."entry_type" AS ENUM('PLAYER', 'TEAM');--> statement-breakpoint
CREATE TABLE "match_game_sides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_game_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "match_game_sides_match_game_id_entry_id_unique" UNIQUE("match_game_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "match_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_games_match_id_game_number_unique" UNIQUE("match_id","game_number")
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"reported_by" uuid,
	"reported_at" timestamp,
	"report_proof" text,
	"finalized_by" uuid,
	"finalized_at" timestamp,
	"finalization_reason" "match_finalization_reason"
);
--> statement-breakpoint
CREATE TABLE "match_sides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"points_awarded" integer DEFAULT 0,
	CONSTRAINT "match_sides_match_id_entry_id_unique" UNIQUE("match_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"team_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_entry_players" (
	"entry_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "tournament_entry_players_entry_id_player_id_unique" UNIQUE("entry_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "match_participation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_participants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "match_participation" CASCADE;--> statement-breakpoint
DROP TABLE "tournament_participants" CASCADE;--> statement-breakpoint
ALTER TABLE "championship_standings" DROP CONSTRAINT "championship_standings_user_id_app_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_team_a_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_team_b_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_winner_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_reported_by_app_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_finalized_by_app_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2026-01-12 21:15:27.004';--> statement-breakpoint
ALTER TABLE "championship_standings" ADD COLUMN "entry_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "match_game_sides" ADD CONSTRAINT "match_game_sides_match_game_id_match_games_id_fk" FOREIGN KEY ("match_game_id") REFERENCES "public"."match_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_game_sides" ADD CONSTRAINT "match_game_sides_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_reported_by_app_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_finalized_by_app_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sides" ADD CONSTRAINT "match_sides_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_players" ADD CONSTRAINT "tournament_entry_players_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_players" ADD CONSTRAINT "tournament_entry_players_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_standings" ADD CONSTRAINT "championship_standings_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "championship_standings" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "round";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "team_a_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "team_b_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "score_a";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "score_b";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "winner_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "winner_side";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "reported_by";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "reported_at";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "report_proof";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "finalized_at";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "finalized_by";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "finalization_reason";