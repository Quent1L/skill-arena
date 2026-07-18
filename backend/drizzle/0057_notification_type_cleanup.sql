-- 1. Rename the odd-cased label. Existing rows follow the label automatically.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'match_created'
  ) THEN
    ALTER TYPE "public"."notification_type" RENAME VALUE 'match_created' TO 'MATCH_CREATED';
  END IF;
END $$;--> statement-breakpoint

-- 2. Drop notifications carrying a value no producer ever wrote (expected: 0 rows).
DELETE FROM "notifications"
WHERE "type"::text IN ('MATCH_INVITE','MATCH_REMINDER','TOURNAMENT_UPDATE','SYSTEM_ALERT');--> statement-breakpoint

-- 3. Recreate the type without the dead values. Removing an enum label requires
--    swapping the type; there is no ALTER TYPE ... DROP VALUE in PostgreSQL.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'SYSTEM_ALERT'
  ) THEN
    ALTER TYPE "public"."notification_type" RENAME TO "notification_type_old";

    CREATE TYPE "public"."notification_type" AS ENUM(
      'MATCH_CREATED','MATCH_VALIDATION','MATCH_SCORE_PROPOSAL',
      'MATCH_POST_DISPUTE','BADGE_AWARDED','BADGE_REVOKED'
    );

    ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type"
      USING "type"::text::"public"."notification_type";

    DROP TYPE "public"."notification_type_old";
  END IF;
END $$;
