CREATE TABLE "game_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "rules_id" uuid;--> statement-breakpoint
ALTER TABLE "game_rules" ADD CONSTRAINT "game_rules_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_rules_id_game_rules_id_fk" FOREIGN KEY ("rules_id") REFERENCES "public"."game_rules"("id") ON DELETE set null ON UPDATE no action;