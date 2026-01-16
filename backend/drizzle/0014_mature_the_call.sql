CREATE TYPE "public"."bracket_round_type" AS ENUM('winners', 'losers', 'bronze');--> statement-breakpoint
CREATE TYPE "public"."bracket_type" AS ENUM('single_elimination', 'double_elimination');--> statement-breakpoint
CREATE TYPE "public"."seeding_type" AS ENUM('random', 'championship_based');--> statement-breakpoint
CREATE TABLE "bracket_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"bracket_type" "bracket_type" NOT NULL,
	"seeding_type" "seeding_type" NOT NULL,
	"source_tournament_id" uuid,
	"total_participants" integer NOT NULL,
	"rounds_count" integer NOT NULL,
	"has_bronze_match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bracket_configs_tournament_id_unique" UNIQUE("tournament_id")
);
--> statement-breakpoint
CREATE TABLE "bracket_match_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"bracket_round_id" uuid NOT NULL,
	"match_number" integer NOT NULL,
	"winner_to_match_id" uuid,
	"loser_to_match_id" uuid,
	"is_bye_match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bracket_match_metadata_match_id_unique" UNIQUE("match_id"),
	CONSTRAINT "bracket_match_metadata_bracket_round_id_match_number_unique" UNIQUE("bracket_round_id","match_number")
);
--> statement-breakpoint
CREATE TABLE "bracket_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bracket_config_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"round_name" text NOT NULL,
	"bracket_type" "bracket_round_type" NOT NULL,
	"matches_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bracket_rounds_bracket_config_id_round_number_bracket_type_unique" UNIQUE("bracket_config_id","round_number","bracket_type")
);
--> statement-breakpoint
CREATE TABLE "bracket_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bracket_config_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"seed_number" integer NOT NULL,
	"seeding_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bracket_seeds_bracket_config_id_entry_id_unique" UNIQUE("bracket_config_id","entry_id"),
	CONSTRAINT "bracket_seeds_bracket_config_id_seed_number_unique" UNIQUE("bracket_config_id","seed_number")
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2026-01-14 18:52:21.631';--> statement-breakpoint
ALTER TABLE "bracket_configs" ADD CONSTRAINT "bracket_configs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_configs" ADD CONSTRAINT "bracket_configs_source_tournament_id_tournaments_id_fk" FOREIGN KEY ("source_tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_match_metadata" ADD CONSTRAINT "bracket_match_metadata_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_match_metadata" ADD CONSTRAINT "bracket_match_metadata_bracket_round_id_bracket_rounds_id_fk" FOREIGN KEY ("bracket_round_id") REFERENCES "public"."bracket_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_match_metadata" ADD CONSTRAINT "bracket_match_metadata_winner_to_match_id_matches_id_fk" FOREIGN KEY ("winner_to_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_match_metadata" ADD CONSTRAINT "bracket_match_metadata_loser_to_match_id_matches_id_fk" FOREIGN KEY ("loser_to_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_rounds" ADD CONSTRAINT "bracket_rounds_bracket_config_id_bracket_configs_id_fk" FOREIGN KEY ("bracket_config_id") REFERENCES "public"."bracket_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_seeds" ADD CONSTRAINT "bracket_seeds_bracket_config_id_bracket_configs_id_fk" FOREIGN KEY ("bracket_config_id") REFERENCES "public"."bracket_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_seeds" ADD CONSTRAINT "bracket_seeds_entry_id_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade ON UPDATE no action;