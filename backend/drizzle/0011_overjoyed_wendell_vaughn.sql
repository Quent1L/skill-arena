ALTER TYPE "public"."notification_type" ADD VALUE 'MATCH_VALIDATION' BEFORE 'TOURNAMENT_UPDATE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'match_created';--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2025-11-24 18:13:16.288';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "translation_params" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "emailed_at";