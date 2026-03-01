DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MATCH_SCORE_PROPOSAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')) THEN
    ALTER TYPE "public"."notification_type" ADD VALUE 'MATCH_SCORE_PROPOSAL';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "match_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_match_id_matches_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
