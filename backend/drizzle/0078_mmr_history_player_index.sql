-- Peak and average MMR have never been stored: they are aggregates computed on
-- read, and until now only ever per season (`getSeasonMmrStats`). The career view
-- transposes that read — one player, every season — which no existing index can
-- serve: `idx_mmr_history_season_player` leads with the season, so a query filtered
-- on `player_id` alone falls back to a sequential scan of the whole table.

CREATE INDEX IF NOT EXISTS "idx_mmr_history_player" ON "mmr_history" ("player_id");
