ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2025-11-16 16:57:03.035';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "winner_side" "match_team_side";