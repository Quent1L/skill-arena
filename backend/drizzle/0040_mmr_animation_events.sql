CREATE TYPE "public"."mmr_animation_event_type" AS ENUM('provisional', 'official');

CREATE TABLE "mmr_animation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "season_id" uuid NOT NULL,
  "match_id" uuid NOT NULL,
  "event_type" "mmr_animation_event_type" NOT NULL,
  "mmr_before" integer NOT NULL,
  "mmr_after" integer NOT NULL,
  "mmr_delta" integer NOT NULL,
  "tier_before_level" integer,
  "tier_after_level" integer,
  "tier_before_name" text,
  "tier_after_name" text,
  "rank_changed" boolean NOT NULL DEFAULT false,
  "viewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "mmr_animation_events_player_season_match_type_unique" UNIQUE("player_id","season_id","match_id","event_type")
);

ALTER TABLE "mmr_animation_events" ADD CONSTRAINT "mmr_animation_events_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mmr_animation_events" ADD CONSTRAINT "mmr_animation_events_season_id_tournaments_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "mmr_animation_events" ADD CONSTRAINT "mmr_animation_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
