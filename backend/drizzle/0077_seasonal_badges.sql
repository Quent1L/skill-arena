-- A badge was a lifetime trophy: `UNIQUE(player_id, rule_id)` meant the second time
-- a player strung ten wins together, the engine had nothing left to give them. A
-- badge rule was therefore only ever interesting to a player who had not yet won it.
--
-- Badges become season trophies instead. The season is now recorded on the award
-- rather than inferred from the awarding match — `match_id` is ON DELETE SET NULL,
-- so the inference was already lost whenever a match was deleted.
--
-- Two partial unique indexes rather than one UNIQUE(player, rule, season): in
-- Postgres NULL <> NULL, so a plain three-column key would let duplicates through
-- on the inherited rows whose season could not be backfilled.
--
-- Lifetime uniqueness (recurrence = 'once') cannot be expressed as an index — it
-- spans every season — and is enforced in `awardBadge`. The partial index below is
-- the backstop for the seasonal case only.

ALTER TABLE "player_badges" ADD COLUMN IF NOT EXISTS "season_id" uuid;
--> statement-breakpoint

UPDATE "player_badges" pb
   SET "season_id" = m."tournament_id"
  FROM "matches" m
 WHERE m."id" = pb."match_id" AND pb."season_id" IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "player_badges"
    ADD CONSTRAINT "player_badges_season_id_tournaments_id_fk"
    FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "player_badges" DROP CONSTRAINT IF EXISTS "player_badges_player_id_rule_id_unique";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "player_badges_player_rule_season_key"
  ON "player_badges" ("player_id", "rule_id", "season_id") WHERE "season_id" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "player_badges_player_rule_legacy_key"
  ON "player_badges" ("player_id", "rule_id") WHERE "season_id" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "player_badges_season_idx" ON "player_badges" ("season_id");
--> statement-breakpoint

-- Every existing badge rule becomes seasonal (the v2 → v3 rule patch stamps the
-- action itself at startup), which makes whole past seasons eligible at once. The
-- reconciliation pass is what actually awards them, so arm it here.
--
-- That catch-up would otherwise send one BADGE_AWARDED notification per badge per
-- season to every player at once, for badges they earned months ago. `silent_next_run`
-- makes the first pass — and only the first — write the rows without notifying.
ALTER TABLE "badge_reconciliation_state"
  ADD COLUMN IF NOT EXISTS "silent_next_run" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

UPDATE "badge_reconciliation_state" SET "dirty" = true, "silent_next_run" = true;
