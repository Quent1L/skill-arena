-- Rules carry the engine version they were authored against. Existing rows predate
-- the versioning, so they are stamped 1 and the startup patch chain brings them up.
ALTER TABLE "rules" ADD COLUMN IF NOT EXISTS "engine_version" integer NOT NULL DEFAULT 1;
