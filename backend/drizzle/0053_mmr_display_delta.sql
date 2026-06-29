ALTER TABLE "mmr_animation_events" ADD COLUMN IF NOT EXISTS "display_delta" integer;
ALTER TABLE "mmr_animation_events" ADD COLUMN IF NOT EXISTS "seen_delta" integer DEFAULT 0;

-- Backfill. seen_delta defaults to 0, so already-pending (unviewed) events keep a
-- 0 baseline and still animate their full delta the first time they are shown.
-- Only events the player has ALREADY seen get their baseline set to the current
-- delta, so a later recalc of those matches surfaces just the change, not a flood
-- of points the player has already watched.
UPDATE "mmr_animation_events" SET "seen_delta" = "mmr_delta" WHERE "viewed_at" IS NOT NULL;
UPDATE "mmr_animation_events" SET "display_delta" = "mmr_delta" WHERE "display_delta" IS NULL;
