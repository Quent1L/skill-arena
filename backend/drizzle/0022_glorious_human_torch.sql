ALTER TABLE "app_users" ADD COLUMN "short_name" text;
UPDATE "app_users" SET "short_name" = UPPER(SUBSTRING("display_name", 1, 5));
ALTER TABLE "app_users" ALTER COLUMN "short_name" SET NOT NULL;
