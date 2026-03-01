ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "winner_side" varchar(1);
