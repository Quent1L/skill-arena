-- Nothing about the rules engine was measured, so three questions had no answer:
-- how often a rule actually evaluated true, who received the message it produced,
-- and whether that person ever read it.
--
-- All three were unanswerable because the engine threw the information away as it
-- went. Only one message rule wins per player (highest priority, random on tie) and
-- the losers left no trace; the winning message is written onto the current match's
-- animation event and vanishes if no such event is produced; and once the client
-- groups several events into the MMR recap, MmrRecapCard renders no message at all.
--
-- This log records one row per (rule, player, match) that evaluated true, losers
-- included, and follows it through delivery and reading. Every figure the admin
-- screens show is derived from here by query — there is no counter to keep in sync.
--
-- NO BACKFILL IS POSSIBLE. Past firings were never recorded in any form; history
-- starts at deploy time and the first days will read as zero.

DO $$ BEGIN
  CREATE TYPE "public"."rule_firing_result" AS ENUM('selected', 'superseded', 'awarded', 'already_held');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."rule_firing_surface" AS ENUM('reveal', 'reveal_skipped', 'recap');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rule_firings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid NOT NULL,
  -- Denormalized: a rule's type is editable, and a firing has to stay readable as
  -- whatever the rule was at the moment it fired.
  "rule_type" "rule_type" NOT NULL,
  "engine_version" integer NOT NULL,
  "trigger_event" text NOT NULL,
  "player_id" uuid NOT NULL,
  "match_id" uuid,
  "season_id" uuid,
  "result" "rule_firing_result" NOT NULL,
  -- Message rules only: which entry of action.variants was drawn.
  "variant_index" integer,
  -- The text actually rendered, after interpolation. Null unless result = 'selected'.
  "message" text,
  -- The animation event that carried the message. Written with delivered_at.
  "animation_event_id" uuid,
  "delivered_at" timestamp with time zone,
  "seen_at" timestamp with time zone,
  "seen_surface" "rule_firing_surface",
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- A match can be finalized more than once (cancel, then resubmit). The unique key
  -- turns the re-run into an update instead of a second firing.
  CONSTRAINT "rule_firings_rule_player_match_key" UNIQUE("rule_id", "player_id", "match_id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rule_firings"
    ADD CONSTRAINT "rule_firings_rule_id_rules_id_fk"
    FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rule_firings"
    ADD CONSTRAINT "rule_firings_player_id_app_users_id_fk"
    FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rule_firings"
    ADD CONSTRAINT "rule_firings_match_id_matches_id_fk"
    FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rule_firings"
    ADD CONSTRAINT "rule_firings_season_id_tournaments_id_fk"
    FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- The animation event is deleted and rebuilt on a recalculation, but the firing it
-- carried still happened. SET NULL keeps the row and only loses the pointer.
DO $$ BEGIN
  ALTER TABLE "rule_firings"
    ADD CONSTRAINT "rule_firings_animation_event_id_mmr_animation_events_id_fk"
    FOREIGN KEY ("animation_event_id") REFERENCES "public"."mmr_animation_events"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rule_firings_rule_created_idx"
  ON "rule_firings" ("rule_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rule_firings_player_created_idx"
  ON "rule_firings" ("player_id", "created_at" DESC);
--> statement-breakpoint

-- Marking events viewed looks firings up by the animation event that carried them.
CREATE INDEX IF NOT EXISTS "rule_firings_animation_event_idx"
  ON "rule_firings" ("animation_event_id");
