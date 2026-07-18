-- Push payloads are rendered server-side (the device is offline), so each device carries
-- the locale and timezone it was registered with. NULL falls back to fr + APP_TIMEZONE.
ALTER TABLE "user_push_devices" ADD COLUMN IF NOT EXISTS "locale" text;
--> statement-breakpoint
ALTER TABLE "user_push_devices" ADD COLUMN IF NOT EXISTS "timezone" text;
