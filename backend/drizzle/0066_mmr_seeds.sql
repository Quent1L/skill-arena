-- Cross-season MMR carry-over: persisted entry MMR + relative soft reset.
--
-- season_mmr_seeds holds the MMR a player enters a season with when the season
-- carries the previous one's ranks over. It is deliberately NOT a column on
-- player_mmr: a seeded player must stay out of the leaderboard, out of the tier
-- percentiles and out of the rewind ranking until they actually play. Every
-- recalculation path reads the seed as its starting point instead of base_mmr,
-- which is what makes the carry-over survive a match finalization or a full
-- season replay.
--
-- soft_reset_factor / source_mmr_season_id make the reset configurable: the seed
-- is computed relative to the source season's median MMR, so it no longer depends
-- on how far that season's distribution drifted from base_mmr.

CREATE TABLE IF NOT EXISTS "season_mmr_seeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "seed_mmr" integer NOT NULL,
  "source_season_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "season_mmr_seeds_season_id_player_id_unique" UNIQUE("season_id","player_id")
);
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "season_mmr_seeds" ADD CONSTRAINT "season_mmr_seeds_season_id_tournaments_id_fk"
    FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "season_mmr_seeds" ADD CONSTRAINT "season_mmr_seeds_player_id_app_users_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "season_mmr_seeds" ADD CONSTRAINT "season_mmr_seeds_source_season_id_tournaments_id_fk"
    FOREIGN KEY ("source_season_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "ranked_season_configs"
  ADD COLUMN IF NOT EXISTS "soft_reset_factor" real DEFAULT 0.5 NOT NULL;
--> statement-breakpoint

ALTER TABLE "ranked_season_configs"
  ADD COLUMN IF NOT EXISTS "source_mmr_season_id" uuid;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "ranked_season_configs" ADD CONSTRAINT "ranked_season_configs_source_mmr_season_id_tournaments_id_fk"
    FOREIGN KEY ("source_mmr_season_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
