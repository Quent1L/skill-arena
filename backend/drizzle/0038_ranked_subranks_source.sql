ALTER TABLE "rank_tiers" ADD COLUMN "sub_ranks" integer DEFAULT 1 NOT NULL;
ALTER TABLE "ranked_season_configs" ADD COLUMN "source_tier_season_id" uuid REFERENCES "tournaments"("id") ON DELETE SET NULL;
