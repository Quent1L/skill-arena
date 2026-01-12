CREATE TYPE "public"."participant_role" AS ENUM('HOME', 'AWAY', 'SEED_1', 'SEED_2', 'SEED_3', 'SEED_4');--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"parent_match_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"opponent1" jsonb,
	"opponent2" jsonb,
	"status" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_participant_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_participant_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "match_participant_players_match_participant_id_player_id_unique" UNIQUE("match_participant_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"team_id" uuid,
	"role" "participant_role" NOT NULL,
	"position" integer NOT NULL,
	"score" integer DEFAULT 0,
	"is_winner" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "match_participants_match_id_position_unique" UNIQUE("match_id","position"),
	CONSTRAINT "match_participants_match_id_role_unique" UNIQUE("match_id","role")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"number" integer NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_registrations_tournament_id_user_id_unique" UNIQUE("tournament_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "match_participation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tournament_participants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "match_participation" CASCADE;--> statement-breakpoint
DROP TABLE "tournament_participants" CASCADE;--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_team_a_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_team_b_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_winner_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2026-01-10 22:17:29.918';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "stage_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "child_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "opponent1" jsonb;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "opponent2" jsonb;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "bracket_status" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_parent_match_id_matches_id_fk" FOREIGN KEY ("parent_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participant_players" ADD CONSTRAINT "match_participant_players_match_participant_id_match_participants_id_fk" FOREIGN KEY ("match_participant_id") REFERENCES "public"."match_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participant_players" ADD CONSTRAINT "match_participant_players_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "team_a_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "team_b_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "score_a";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "score_b";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "winner_id";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "winner_side";