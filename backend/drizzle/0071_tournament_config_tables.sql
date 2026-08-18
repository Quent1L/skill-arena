-- Championship-specific knobs move off "tournaments" into two 1:1 satellites,
-- following the shape already used by bracket_configs and ranked_season_configs.
--
-- The split is by concern, not by mode:
--   tournament_scoring_configs  points per result — every point-scored mode
--                               (championship, bracket), never ranked
--   championship_configs        pairing caps — only user-created matches are
--                               validated against them, which is championship-only
--
-- Before this, every ranked season carried a meaningless 10/2/2/3/1/0, and the
-- defaults were declared three times (DB, service, zod). A missing row now means
-- "this mode has no such setting"; readers fall back to the shared defaults.
--
-- Group phases (poules) are not modelled yet. When they land, the caps become
-- per-phase while the scoring stays tournament-wide:
--   ALTER TABLE championship_configs ADD COLUMN phase_id uuid
--     REFERENCES tournament_phases(id) ON DELETE cascade;
--   ALTER TABLE championship_configs DROP CONSTRAINT
--     championship_configs_tournament_id_unique;
--   CREATE UNIQUE INDEX ON championship_configs (tournament_id, phase_id)
--     NULLS NOT DISTINCT;

CREATE TABLE IF NOT EXISTS "tournament_scoring_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE cascade,
  "point_per_victory" integer DEFAULT 3 NOT NULL,
  "point_per_draw" integer DEFAULT 1 NOT NULL,
  "point_per_loss" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "tournament_scoring_configs_tournament_id_unique" UNIQUE("tournament_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "championship_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE cascade,
  "max_matches_per_player" integer DEFAULT 10 NOT NULL,
  "max_times_with_same_partner" integer DEFAULT 2 NOT NULL,
  "max_times_with_same_opponent" integer DEFAULT 2 NOT NULL,
  CONSTRAINT "championship_configs_tournament_id_unique" UNIQUE("tournament_id")
);
--> statement-breakpoint

-- Backfill runs before the drops. The point_per_* source columns are nullable,
-- hence the COALESCE onto the same defaults the columns carried.
INSERT INTO "tournament_scoring_configs"
  ("tournament_id", "point_per_victory", "point_per_draw", "point_per_loss")
SELECT
  "id",
  COALESCE("point_per_victory", 3),
  COALESCE("point_per_draw", 1),
  COALESCE("point_per_loss", 0)
FROM "tournaments"
WHERE "mode" <> 'ranked'
ON CONFLICT ("tournament_id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "championship_configs"
  ("tournament_id", "max_matches_per_player", "max_times_with_same_partner", "max_times_with_same_opponent")
SELECT
  "id",
  "max_matches_per_player",
  "max_times_with_same_partner",
  "max_times_with_same_opponent"
FROM "tournaments"
WHERE "mode" = 'championship'
ON CONFLICT ("tournament_id") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "max_matches_per_player";
--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "max_times_with_same_partner";
--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "max_times_with_same_opponent";
--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "point_per_victory";
--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "point_per_draw";
--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "point_per_loss";
