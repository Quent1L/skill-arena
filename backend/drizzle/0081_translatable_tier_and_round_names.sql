-- Rank tiers and bracket rounds were named once, in French, at the moment they were
-- created: a season seeded with "Confirmé" or a round called "Demi-finales" kept that
-- text for every viewer, whatever locale the app was set to.
--
-- The name column stays as it is — it remains the server-rendered fallback, and rows
-- created before this migration have nothing else. What is added is the i18n key that
-- produced it (plus its interpolation values for the numbered rounds), so a client that
-- knows the key renders the label in its own locale instead of reading the stored text.
--
-- Both keys are nullable on purpose: NULL means "no translation, show the stored name",
-- which is exactly the state of existing rows and of a tier an organizer renamed by hand.

ALTER TABLE "rank_tiers"
  ADD COLUMN IF NOT EXISTS "name_key" text;

ALTER TABLE "bracket_rounds"
  ADD COLUMN IF NOT EXISTS "round_name_key" text;

ALTER TABLE "bracket_rounds"
  ADD COLUMN IF NOT EXISTS "translation_params" jsonb;
