CREATE TYPE "public"."match_finalization_reason" AS ENUM('consensus', 'auto_validation', 'admin_override');--> statement-breakpoint
ALTER TYPE "public"."match_status" ADD VALUE 'finalized';--> statement-breakpoint
CREATE TABLE "match_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"is_contested" boolean DEFAULT false NOT NULL,
	"contestation_reason" text,
	"contestation_proof" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_confirmations_match_id_player_id_unique" UNIQUE("match_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2025-11-16 16:35:39.892';--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmation_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "finalized_at" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "finalized_by" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "finalization_reason" "match_finalization_reason";--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_finalized_by_app_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;