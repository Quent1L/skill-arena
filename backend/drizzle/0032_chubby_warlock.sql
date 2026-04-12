ALTER TYPE "public"."tournament_mode" ADD VALUE 'ranked';--> statement-breakpoint
CREATE TABLE "mmr_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"mmr_before" integer NOT NULL,
	"mmr_after" integer NOT NULL,
	"mmr_delta" integer NOT NULL,
	"k_effective" real NOT NULL,
	"opponent_avg_mmr" integer NOT NULL,
	"is_placement" boolean DEFAULT false NOT NULL,
	CONSTRAINT "mmr_history_season_id_player_id_match_id_unique" UNIQUE("season_id","player_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "player_mmr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"current_mmr" integer NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"win_streak" integer DEFAULT 0 NOT NULL,
	"max_win_streak" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_mmr_season_id_player_id_unique" UNIQUE("season_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "rank_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"challenger_max" integer NOT NULL,
	"strategist_max" integer NOT NULL,
	"master_max" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rank_boundaries_season_id_unique" UNIQUE("season_id")
);
--> statement-breakpoint
CREATE TABLE "ranked_season_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"base_mmr" integer DEFAULT 1000 NOT NULL,
	"k_factor" integer DEFAULT 32 NOT NULL,
	"placement_matches" integer DEFAULT 5 NOT NULL,
	"use_previous_mmr" boolean DEFAULT false NOT NULL,
	"allow_asymmetric_matches" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ranked_season_configs_tournament_id_unique" UNIQUE("tournament_id")
);
--> statement-breakpoint
ALTER TABLE "outcome_types" ADD COLUMN "score_counts_for_mmr" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mmr_history" ADD CONSTRAINT "mmr_history_season_id_tournaments_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mmr_history" ADD CONSTRAINT "mmr_history_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mmr_history" ADD CONSTRAINT "mmr_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_mmr" ADD CONSTRAINT "player_mmr_season_id_tournaments_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_mmr" ADD CONSTRAINT "player_mmr_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_boundaries" ADD CONSTRAINT "rank_boundaries_season_id_tournaments_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranked_season_configs" ADD CONSTRAINT "ranked_season_configs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;