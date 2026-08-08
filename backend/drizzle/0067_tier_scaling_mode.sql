-- How a copied ladder's MMR thresholds are resolved when a season starts.
--
-- 'keep' (the default, and the previous behaviour restored) copies the source
-- season's thresholds verbatim: nothing rewrites a ladder behind the admin's back.
-- 'percentile' rebuilds them from the source season's peak-MMR distribution, then
-- maps them onto the new season's scale with the same soft-reset transform the
-- player seeds go through.
--
-- Note this is only about *copying* a ladder. The percentile recalculation exposed
-- at POST /ranked/seasons/:id/tiers/recalculate stays a manual admin action.

ALTER TABLE "ranked_season_configs"
  ADD COLUMN IF NOT EXISTS "tier_scaling_mode" text DEFAULT 'keep' NOT NULL;
