-- Fun stats by outcome type now return ranked volume/efficiency lists instead of a single
-- topWinner/topLoser pair. The cached payloads carry the old shape, so the frontend would
-- read undefined fields until the next recompute. This cache is read-through, so dropping
-- the stats rows only costs one recompute on the next read.
DELETE FROM "computed_data" WHERE "key" = 'stats';
