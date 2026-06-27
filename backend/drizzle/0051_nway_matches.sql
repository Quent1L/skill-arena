-- N-way matches (1v1v1, 2v2v2, …): per-side rank + tournament-level config

CREATE TYPE "public"."standings_points_source" AS ENUM ('match_result', 'rank', 'score');
--> statement-breakpoint
ALTER TABLE "match_sides" ADD COLUMN IF NOT EXISTS "rank" integer;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "max_sides_per_match" integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "standings_points_source" "public"."standings_points_source" DEFAULT 'match_result' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "rank_points" jsonb;
--> statement-breakpoint
UPDATE "match_sides" ms SET "rank" = CASE
  WHEN m."winner_side" IS NULL THEN 1
  WHEN (m."winner_side" = 'A' AND ms."position" = 1) THEN 1
  WHEN (m."winner_side" = 'B' AND ms."position" = 2) THEN 1
  ELSE 2
END
FROM "matches" m
WHERE ms."match_id" = m."id" AND ms."rank" IS NULL;
