DO $$ BEGIN
  CREATE TYPE "public"."rule_type" AS ENUM ('message', 'badge');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."rule_scope" AS ENUM ('global', 'discipline');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trigger_event" text NOT NULL,
  "type" "rule_type" NOT NULL,
  "scope" "rule_scope" NOT NULL,
  "discipline_id" uuid,
  "priority" integer DEFAULT 0 NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "conditions" jsonb NOT NULL,
  "action" jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_badges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "match_id" uuid,
  "viewed_at" timestamp with time zone,
  CONSTRAINT "player_badges_player_id_rule_id_unique" UNIQUE("player_id","rule_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rules" ADD CONSTRAINT "rules_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rules" ADD CONSTRAINT "rules_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_badges" ADD CONSTRAINT "player_badges_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_badges" ADD CONSTRAINT "player_badges_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_badges" ADD CONSTRAINT "player_badges_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "player_mmr" ADD COLUMN IF NOT EXISTS "loss_streak" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "player_mmr" ADD COLUMN IF NOT EXISTS "max_loss_streak" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "mmr_animation_events" ADD COLUMN IF NOT EXISTS "message" text;
