-- Outcome-type fun stats now return leaderboard objects (leaders + tie metadata) instead
-- of bare arrays, and every ranked entry carries a competition rank. Cached payloads hold
-- the previous shape, so the frontend would read undefined fields until the next
-- recompute. This cache is read-through: dropping the rows only costs one recompute on
-- the next read.
DELETE FROM "computed_data" WHERE "key" = 'stats';
