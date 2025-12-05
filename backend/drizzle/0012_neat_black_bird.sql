CREATE TYPE "public"."bracket_type" AS ENUM('winner', 'loser', 'grand_final');--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2025-11-30 16:04:16.646';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "bracket_type" "bracket_type" DEFAULT 'winner';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "sequence" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "next_match_win_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "next_match_lose_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_position" integer;