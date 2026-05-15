CREATE TYPE "public"."validation_mode" AS ENUM('auto', 'strict', 'admin');

ALTER TABLE "tournaments"
  ADD COLUMN "validation_mode" "validation_mode" NOT NULL DEFAULT 'strict',
  ADD COLUMN "validation_timer_hours" integer;

ALTER TABLE "app_users"
  ADD COLUMN "trust_score_count" integer NOT NULL DEFAULT 0;

ALTER TYPE "public"."match_finalization_reason" ADD VALUE IF NOT EXISTS 'trust_score';
