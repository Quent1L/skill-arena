ALTER TABLE "disciplines" ADD COLUMN IF NOT EXISTS "score_instructions" text;--> statement-breakpoint
ALTER TABLE "outcome_types" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;
