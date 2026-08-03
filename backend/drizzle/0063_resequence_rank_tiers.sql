-- Deleting a rank tier used to leave a hole in the level sequence (1, 2, 4, 5).
-- Levels are now kept contiguous at 1..N per season; this closes the holes that
-- already exist and realigns the levels frozen in mmr_animation_events.
-- Idempotent: on an already contiguous season every new_level equals old_level.
DO $$
BEGIN
  -- First, drop the levels that already point at a deleted rank. Doing this
  -- after the renumbering would silently remap them onto a surviving tier.
  UPDATE mmr_animation_events e
  SET tier_before_level = NULL
  WHERE e.tier_before_level IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM rank_tiers t
      WHERE t.season_id = e.season_id AND t.level = e.tier_before_level
    );

  UPDATE mmr_animation_events e
  SET tier_after_level = NULL
  WHERE e.tier_after_level IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM rank_tiers t
      WHERE t.season_id = e.season_id AND t.level = e.tier_after_level
    );

  CREATE TEMP TABLE tmp_rank_tier_resequence ON COMMIT DROP AS
  SELECT
    id,
    season_id,
    level AS old_level,
    row_number() OVER (PARTITION BY season_id ORDER BY level)::int AS new_level
  FROM rank_tiers;

  -- UNIQUE(season_id, level) is checked row by row, so shift through negative
  -- values first to avoid colliding with a tier that has not moved yet.
  UPDATE rank_tiers t
  SET level = -t.level
  FROM tmp_rank_tier_resequence r
  WHERE t.id = r.id AND r.new_level <> r.old_level;

  UPDATE rank_tiers t
  SET level = r.new_level
  FROM tmp_rank_tier_resequence r
  WHERE t.id = r.id AND r.new_level <> r.old_level;

  UPDATE mmr_animation_events e
  SET tier_before_level = r.new_level
  FROM tmp_rank_tier_resequence r
  WHERE e.season_id = r.season_id
    AND e.tier_before_level = r.old_level
    AND r.new_level <> r.old_level;

  UPDATE mmr_animation_events e
  SET tier_after_level = r.new_level
  FROM tmp_rank_tier_resequence r
  WHERE e.season_id = r.season_id
    AND e.tier_after_level = r.old_level
    AND r.new_level <> r.old_level;
END $$;
