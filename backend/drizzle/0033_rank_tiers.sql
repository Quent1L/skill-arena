DROP TABLE "rank_boundaries";--> statement-breakpoint
CREATE TABLE "rank_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"percentile" real NOT NULL,
	"min_mmr" integer NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rank_tiers_season_id_level_unique" UNIQUE("season_id","level")
);
--> statement-breakpoint
ALTER TABLE "rank_tiers" ADD CONSTRAINT "rank_tiers_season_id_tournaments_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
