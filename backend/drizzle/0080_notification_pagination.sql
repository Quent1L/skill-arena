-- The notification feed was read whole on every load: no limit, no cursor, and no index
-- that could serve it. `notifications` carried nothing but its primary key, and
-- `notification_status` only a unique on (notification_id, user_id) — whose leading
-- column is the notification, so filtering on a user fell back to a sequential scan of
-- every row in the table.
--
-- The first index lets the paginated read walk one user's history in order, newest first,
-- so a LIMIT stops early instead of sorting everything; the id tie-breaks, which is what
-- makes the keyset cursor stable across pages. The second answers the unread badge and
-- the bulk read/delete, all of which filter on the user alone.

CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
  ON "notifications" ("user_id", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_status_user_read_idx"
  ON "notification_status" ("user_id", "read");
