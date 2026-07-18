-- Notification match dates were stored as a pre-formatted `dd/MM/yyyy HH:mm` string built
-- with the server process timezone (UTC in production). Convert them to ISO instants so the
-- reader's device owns the formatting.

-- 1. Authoritative source: matches.played_at, when the notification links a match.
--    `AT TIME ZONE 'UTC'` makes the result independent of the PostgreSQL session timezone.
UPDATE notifications n
SET translation_params = jsonb_set(
      n.translation_params,
      '{matchDate}',
      to_jsonb(to_char(m.played_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    )
FROM matches m
WHERE n.match_id = m.id
  AND m.played_at IS NOT NULL
  AND n.translation_params ->> 'matchDate' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$';
--> statement-breakpoint

-- 2. Fallback: rebuild the ISO string from the legacy one by slicing it, reading it as UTC
--    (the production process timezone). Deliberately avoids to_timestamp(), which would
--    interpret the text in the session timezone and shift the result.
UPDATE notifications
SET translation_params = jsonb_set(
      translation_params,
      '{matchDate}',
      to_jsonb(
        substr(translation_params ->> 'matchDate', 7, 4) || '-' ||   -- YYYY
        substr(translation_params ->> 'matchDate', 4, 2) || '-' ||   -- MM
        substr(translation_params ->> 'matchDate', 1, 2) || 'T' ||   -- DD
        substr(translation_params ->> 'matchDate', 12, 5) ||         -- HH:MI
        ':00.000Z'
      )
    )
WHERE translation_params ->> 'matchDate' ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$';
--> statement-breakpoint

-- 3. Hardcoded French labels become null/empty, resolved by the client locale
UPDATE notifications
SET translation_params = jsonb_set(translation_params, '{matchDate}', 'null'::jsonb)
WHERE translation_params ->> 'matchDate' = 'À définir';
--> statement-breakpoint

UPDATE notifications
SET translation_params = jsonb_set(translation_params, '{teammates}', '""'::jsonb)
WHERE translation_params ->> 'teammates' = 'Aucun';
