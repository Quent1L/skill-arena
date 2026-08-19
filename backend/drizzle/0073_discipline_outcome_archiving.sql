-- Archiving replaces the destructive hard delete of a discipline / outcome type,
-- and matches stop losing the outcome they were played under.
--
-- Before this, deleting a discipline could never fail: outcome_types and
-- outcome_reasons cascaded away, and every matches.outcome_type_id pointing at
-- them was set to NULL. Those matches then silently fell back to a hardcoded
-- points: 3 / mmrMultiplier: 1 / "Défaut", quietly rewriting standings
-- tiebreakers and MMR for competitions that were already over.
--
-- Two changes:
--   1. archived_at / archived_by, mirroring app_users (0060_user_archiving.sql).
--      An archived row disappears from the creation and match-entry selectors but
--      stays readable, so historical matches keep resolving their outcome.
--   2. matches.outcome_type_id / outcome_reason_id move from "set null" to
--      "restrict". The parent links (outcome_types.discipline_id,
--      outcome_reasons.outcome_type_id) deliberately STAY on cascade: an outcome
--      definition nothing has ever played under is still free to be deleted
--      outright, and the restrict above stops the cascade the moment a match
--      depends on it.

ALTER TABLE "disciplines" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "disciplines" ADD COLUMN IF NOT EXISTS "archived_by" uuid;
ALTER TABLE "outcome_types" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "outcome_types" ADD COLUMN IF NOT EXISTS "archived_by" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "disciplines"
    ADD CONSTRAINT "disciplines_archived_by_app_users_id_fk"
    FOREIGN KEY ("archived_by") REFERENCES "app_users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "outcome_types"
    ADD CONSTRAINT "outcome_types_archived_by_app_users_id_fk"
    FOREIGN KEY ("archived_by") REFERENCES "app_users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "disciplines_archived_at_idx" ON "disciplines" ("archived_at");
CREATE INDEX IF NOT EXISTS "outcome_types_archived_at_idx" ON "outcome_types" ("archived_at");
--> statement-breakpoint

-- "restrict" constrains DELETE of the referenced row only. Rows that already have
-- a NULL outcome_type_id (orphaned by a pre-0073 delete) are left as they are —
-- they keep resolving through the default outcome, which is why that fallback
-- has to survive.
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_outcome_type_id_outcome_types_id_fk";
--> statement-breakpoint
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_outcome_type_id_outcome_types_id_fk"
  FOREIGN KEY ("outcome_type_id") REFERENCES "public"."outcome_types"("id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_outcome_reason_id_outcome_reasons_id_fk";
--> statement-breakpoint
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_outcome_reason_id_outcome_reasons_id_fk"
  FOREIGN KEY ("outcome_reason_id") REFERENCES "public"."outcome_reasons"("id")
  ON DELETE restrict ON UPDATE no action;
