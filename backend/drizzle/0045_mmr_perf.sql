CREATE INDEX IF NOT EXISTS idx_matches_tournament_status_played_at
  ON matches(tournament_id, status, played_at);

CREATE INDEX IF NOT EXISTS idx_tep_player_id
  ON tournament_entry_players(player_id);

CREATE INDEX IF NOT EXISTS idx_mmr_history_season_player
  ON mmr_history(season_id, player_id);

ALTER TABLE mmr_history ADD COLUMN IF NOT EXISTS outcome varchar(4);
