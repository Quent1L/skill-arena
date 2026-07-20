-- Admin user management: activity tracking + soft delete
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "deactivated_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "app_users"
    ADD CONSTRAINT "app_users_deactivated_by_app_users_id_fk"
    FOREIGN KEY ("deactivated_by") REFERENCES "public"."app_users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_users_deactivated_at_idx" ON "app_users" USING btree ("deactivated_at");
