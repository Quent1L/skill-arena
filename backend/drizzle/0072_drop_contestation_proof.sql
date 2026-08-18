-- `contestation_proof` was never written nor read: contestations only ever carried
-- `contestation_reason`, and any evidence goes through the match discussion thread.
ALTER TABLE "match_confirmations" DROP COLUMN IF EXISTS "contestation_proof";
