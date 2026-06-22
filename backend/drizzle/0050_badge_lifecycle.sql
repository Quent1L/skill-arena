ALTER TABLE "mmr_history" ADD COLUMN IF NOT EXISTS "win_streak_after" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "mmr_history" ADD COLUMN IF NOT EXISTS "loss_streak_after" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "mmr_history" ADD COLUMN IF NOT EXISTS "matches_played_after" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'BADGE_AWARDED';
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'BADGE_REVOKED';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "badge_reconciliation_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dirty" boolean DEFAULT false NOT NULL,
  "last_run_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "badge_reconciliation_state" ("dirty")
  SELECT false WHERE NOT EXISTS (SELECT 1 FROM "badge_reconciliation_state");
