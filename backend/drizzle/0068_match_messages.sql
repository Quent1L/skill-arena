-- Clarifies the match validation flow.
--
-- The score counter-proposal is removed: a contesting player can no longer submit an
-- alternative score. Instead the author of the entry corrects it themselves while the
-- match is not finalized, and players discuss the disagreement in a per-match thread.
-- That drops the 'pending_confirmation' status (matches sitting there are folded back
-- into 'reported', which is what they mean now) and the proposed_* columns.
--
-- The enum values 'pending_confirmation' and 'confirmed' stay declared: PostgreSQL
-- cannot remove a member from an enum type without recreating it, and no code path
-- writes them anymore.
UPDATE "matches" SET "status" = 'reported' WHERE "status" = 'pending_confirmation';
--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "proposed_score_a";
--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "proposed_score_b";
--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "proposed_winner";
--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "proposed_outcome_type_id";
--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "proposed_outcome_reason_id";
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'MATCH_DISPUTE_ESCALATED';
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'MATCH_MESSAGE';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."match_message_kind" AS ENUM ('user', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- 'user' messages hold plain text typed by a participant. 'system' messages hold an
-- i18n key in "body" with its interpolation values in "translation_params", the same
-- convention the notifications table uses.
CREATE TABLE IF NOT EXISTS "match_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE cascade,
  "author_id" uuid REFERENCES "app_users"("id") ON DELETE set null,
  "kind" "public"."match_message_kind" DEFAULT 'user' NOT NULL,
  "body" text NOT NULL,
  "translation_params" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_messages_match_created_idx"
  ON "match_messages" ("match_id", "created_at");
