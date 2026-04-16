CREATE TABLE IF NOT EXISTS "computed_data" (
  "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "data" jsonb NOT NULL,
  "computed_at" timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tournament_id", "key")
);
