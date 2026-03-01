ALTER TABLE "match_confirmations" ADD COLUMN IF NOT EXISTS "proposed_score_a" integer;--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD COLUMN IF NOT EXISTS "proposed_score_b" integer;
