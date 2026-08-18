-- Why the startup patch chain deactivated a rule. Null when the rule was never
-- auto-deactivated; cleared as soon as an admin saves the rule again.
ALTER TABLE "rules" ADD COLUMN IF NOT EXISTS "disabled_reason" text;
