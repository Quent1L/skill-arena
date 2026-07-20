-- Archiving replaces the destructive hard delete of a player.
--
-- Deleting the Better Auth "user" row used to cascade into app_users, which in turn
-- cascades into 15 tables (tournament_entry_players, match_player_points, player_mmr,
-- mmr_history, player_badges...). Losing the account therefore meant losing the whole
-- tournament history of that player.
--
-- external_id becomes nullable with ON DELETE SET NULL: the identity can be destroyed
-- (login, sessions, linked SSO accounts) while the app_users row survives, anonymised.

ALTER TABLE "app_users" ALTER COLUMN "external_id" DROP NOT NULL;

ALTER TABLE "app_users" DROP CONSTRAINT IF EXISTS "app_users_external_id_user_id_fk";

DO $$ BEGIN
  ALTER TABLE "app_users"
    ADD CONSTRAINT "app_users_external_id_user_id_fk"
    FOREIGN KEY ("external_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "archived_by" uuid;

DO $$ BEGIN
  ALTER TABLE "app_users"
    ADD CONSTRAINT "app_users_archived_by_app_users_id_fk"
    FOREIGN KEY ("archived_by") REFERENCES "app_users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "app_users_archived_at_idx" ON "app_users" ("archived_at");
