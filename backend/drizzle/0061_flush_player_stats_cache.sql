-- Best partners and nemeses are now ranked by win rate weighted by match count, and the
-- cached payloads carry a new "winRate" field. These caches are read-through, so dropping
-- every row only costs one recompute on the next read.
DELETE FROM "player_computed_data";
