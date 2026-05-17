ALTER TABLE "mmr_animation_events" ADD COLUMN IF NOT EXISTS "reason" text NOT NULL DEFAULT 'match_finalized';
