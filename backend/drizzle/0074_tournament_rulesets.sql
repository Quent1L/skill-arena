-- Every discipline setting that weighs on a result is frozen per competition.
--
-- Until now teamInteractionMode, mmrMultiplier, scoreCountsForMmr and the
-- outcome points were read live at compute AND display time. Editing a
-- discipline therefore rewrote the MMR and the standings tiebreakers of
-- competitions that were already finished — silently, and only visible once
-- some unrelated event flushed the standings cache.
--
-- A ranked season is a `tournaments` row with mode = 'ranked', so this 1:1
-- satellite covers seasons too. Shape follows tournament_scoring_configs (0071).
--
-- BACKFILL CAVEAT: the seed below freezes TODAY's live values. A competition
-- whose discipline was edited while it ran is frozen at its current, possibly
-- already drifted, state — the values in force when each match was played were
-- never recorded anywhere and cannot be reconstructed. What this stops is any
-- further drift from this point on.

CREATE TABLE IF NOT EXISTS "tournament_rulesets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Job-state marker, not cache: set when a propagation queues a recalculation,
  -- cleared when it lands. Drives the "recalculation running" banner.
  "recalc_pending_at" timestamp with time zone,
  CONSTRAINT "tournament_rulesets_tournament_id_unique" UNIQUE("tournament_id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "tournament_rulesets"
    ADD CONSTRAINT "tournament_rulesets_tournament_id_tournaments_id_fk"
    FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tournament_rulesets_recalc_pending_at_idx"
  ON "tournament_rulesets" ("recalc_pending_at");
--> statement-breakpoint

-- Seed one row per existing competition from the discipline as it stands now.
--
-- Archived outcome types are included: a match already tagged with one still has
-- to resolve its points and multiplier. So are types the tournament's matches
-- reference without belonging to its discipline — discipline_id is nullable and
-- used to be set to NULL whenever a discipline was deleted, so those matches do
-- exist and their labels would otherwise be lost.
INSERT INTO "tournament_rulesets" ("tournament_id", "payload", "version", "applied_at")
SELECT
  t."id",
  jsonb_build_object(
    'discipline',
    CASE
      WHEN d."id" IS NULL THEN 'null'::jsonb
      ELSE jsonb_build_object(
        'id', d."id",
        'name', d."name",
        'teamInteractionMode', to_jsonb(d."team_interaction_mode")
      )
    END,
    'outcomeTypes',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ot."id",
          'name', ot."name",
          'points', ot."points",
          'mmrMultiplier', ot."mmr_multiplier",
          'scoreCountsForMmr', ot."score_counts_for_mmr",
          'isDefault', ot."is_default",
          'archivedAt', to_jsonb(ot."archived_at"),
          'reasons', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object('id', orr."id", 'name', orr."name")
              ORDER BY orr."name"
            )
            FROM "outcome_reasons" orr
            WHERE orr."outcome_type_id" = ot."id"
          ), '[]'::jsonb)
        )
        ORDER BY ot."name"
      )
      FROM "outcome_types" ot
      WHERE ot."discipline_id" IS NOT DISTINCT FROM d."id"
         OR ot."id" IN (
              SELECT m."outcome_type_id" FROM "matches" m
              WHERE m."tournament_id" = t."id" AND m."outcome_type_id" IS NOT NULL
            )
    ), '[]'::jsonb)
  ),
  1,
  now()
FROM "tournaments" t
LEFT JOIN "disciplines" d ON d."id" = t."discipline_id"
ON CONFLICT ("tournament_id") DO NOTHING;
