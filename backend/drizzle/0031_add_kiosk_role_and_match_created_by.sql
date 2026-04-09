ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'kiosk';

ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "created_by" uuid
  REFERENCES "app_users"("id") ON DELETE SET NULL;
