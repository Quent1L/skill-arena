-- The best-team and best-player sections of the tournament stats now return boards
-- ({ entries, isLowSample }) instead of bare arrays, and every entry carries the weighted
-- score its ranking is sorted on. Cached payloads hold the previous shape, so the cards
-- would read `.entries` off an array until the next recompute. This cache is read-through:
-- dropping the rows only costs one recompute on the next read.
DELETE FROM "computed_data" WHERE "key" = 'stats';
