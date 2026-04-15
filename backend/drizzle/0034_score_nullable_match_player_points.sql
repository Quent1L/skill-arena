-- Make match_sides.score nullable (stores null when scoreEnabled=false)
ALTER TABLE "match_sides" ALTER COLUMN "score" DROP NOT NULL;
ALTER TABLE "match_sides" ALTER COLUMN "score" DROP DEFAULT;

-- Per-player point tracking for flex championship tournaments
CREATE TABLE IF NOT EXISTS "match_player_points" (
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "points_awarded" integer NOT NULL,
  "counts_for_ranking" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("match_id", "player_id")
);
