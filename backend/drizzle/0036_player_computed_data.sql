CREATE TABLE IF NOT EXISTS "player_computed_data" (
  "player_id"   uuid NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
  "key"         text NOT NULL,
  "data"        jsonb NOT NULL,
  "computed_at" timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("player_id", "key")
);
