CREATE TABLE "disciplines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome_type_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discipline_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_tournament_id_team_a_id_team_b_id_unique";--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_tournament_id_hash_unique";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_confirmation_by_app_users_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "outcome_type_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "outcome_reason_id" uuid;--> statement-breakpoint
ALTER TABLE "outcome_reasons" ADD CONSTRAINT "outcome_reasons_outcome_type_id_outcome_types_id_fk" FOREIGN KEY ("outcome_type_id") REFERENCES "public"."outcome_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_types" ADD CONSTRAINT "outcome_types_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_outcome_type_id_outcome_types_id_fk" FOREIGN KEY ("outcome_type_id") REFERENCES "public"."outcome_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_outcome_reason_id_outcome_reasons_id_fk" FOREIGN KEY ("outcome_reason_id") REFERENCES "public"."outcome_reasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "confirmation_by";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "confirmation_at";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "hash";