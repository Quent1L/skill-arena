ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "bootstrap_pending" boolean DEFAULT false NOT NULL;
