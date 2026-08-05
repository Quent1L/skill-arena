-- Season Rewind: immutable end-of-season recap snapshots.
--
-- A rewind is computed once when a season closes and never recomputed on read,
-- so the tables below are a cache in lifetime but a source of truth in practice:
-- viewed_at / opened_at / promoted_until carry per-player state that must survive
-- a regeneration.
--
-- season_id is nullable on purpose. A future 'year' rewind aggregates several
-- seasons and belongs to no single tournament; it is identified by
-- (discipline_id, period_key) instead. The CHECK below keeps the two shapes from
-- bleeding into each other.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rewind_scope') THEN
    CREATE TYPE "public"."rewind_scope" AS ENUM('season', 'year');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "season_rewinds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid,
  "scope" "rewind_scope" DEFAULT 'season' NOT NULL,
  "period_key" text,
  "discipline_id" uuid,
  "payload" jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "season_rewinds_scope_shape" CHECK (
    ("scope" = 'season' AND "season_id" IS NOT NULL AND "period_key" IS NULL)
    OR ("scope" = 'year' AND "period_key" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "player_season_rewinds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rewind_id" uuid NOT NULL,
  "player_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "promoted_until" timestamp with time zone NOT NULL,
  "opened_at" timestamp with time zone,
  "viewed_at" timestamp with time zone,
  CONSTRAINT "player_season_rewinds_rewind_id_player_id_unique" UNIQUE("rewind_id","player_id")
);
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "season_rewinds" ADD CONSTRAINT "season_rewinds_season_id_tournaments_id_fk"
    FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "season_rewinds" ADD CONSTRAINT "season_rewinds_discipline_id_disciplines_id_fk"
    FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "player_season_rewinds" ADD CONSTRAINT "player_season_rewinds_rewind_id_season_rewinds_id_fk"
    FOREIGN KEY ("rewind_id") REFERENCES "public"."season_rewinds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "player_season_rewinds" ADD CONSTRAINT "player_season_rewinds_player_id_app_users_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Partial uniques rather than a plain UNIQUE: NULL never conflicts in Postgres,
-- so UNIQUE(season_id, scope, period_key) would happily accept duplicate year
-- rewinds. One index per shape instead.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_season_rewinds_season"
  ON "season_rewinds" ("season_id") WHERE "scope" = 'season';
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_season_rewinds_year"
  ON "season_rewinds" ("discipline_id", "period_key") WHERE "scope" = 'year';
--> statement-breakpoint

-- Hot path: the promo lookup runs on every home page render.
CREATE INDEX IF NOT EXISTS "idx_player_season_rewinds_promoted"
  ON "player_season_rewinds" ("player_id", "promoted_until") WHERE "viewed_at" IS NULL;
