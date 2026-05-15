ALTER TABLE "match_confirmations" ADD COLUMN "side_position" integer;--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD COLUMN "is_post_finalization" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "match_confirmations" mc
SET "side_position" = (
  SELECT ms.position
  FROM "match_sides" ms
  JOIN "tournament_entries" te ON te.id = ms.entry_id
  JOIN "tournament_entry_players" tep ON tep.entry_id = te.id
  WHERE ms.match_id = mc.match_id AND tep.player_id = mc.player_id
  LIMIT 1
);--> statement-breakpoint
ALTER TABLE "match_confirmations" DROP CONSTRAINT IF EXISTS "match_confirmations_match_id_player_id_unique";--> statement-breakpoint
ALTER TABLE "match_confirmations" ADD CONSTRAINT "match_confirmations_match_id_player_id_post_unique" UNIQUE("match_id","player_id","is_post_finalization");
