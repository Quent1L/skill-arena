ALTER TABLE "match_confirmations" ADD COLUMN IF NOT EXISTS "proposed_winner" text;--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD COLUMN IF NOT EXISTS "proposed_outcome_type_id" uuid;--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD COLUMN IF NOT EXISTS "proposed_outcome_reason_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_confirmations_proposed_outcome_type_id_outcome_types_id_fk') THEN
    ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_proposed_outcome_type_id_outcome_types_id_fk" FOREIGN KEY ("proposed_outcome_type_id") REFERENCES "public"."outcome_types"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_confirmations_proposed_outcome_reason_id_outcome_reasons_id_fk') THEN
    ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_proposed_outcome_reason_id_outcome_reasons_id_fk" FOREIGN KEY ("proposed_outcome_reason_id") REFERENCES "public"."outcome_reasons"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;