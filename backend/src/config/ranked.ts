/**
 * Reporting window for ranked matches.
 *
 * A ranked match must be declared within this many hours of being played. Set
 * RANKED_MATCH_MAX_AGE_HOURS to 0 to turn the age check off entirely — that is what
 * scripts/seed-ranked-matches.ts needs to backfill an historical season.
 */
const DEFAULT_MATCH_MAX_AGE_HOURS = 48;

/** Read at call time, not at import time: tests and seed runs flip it per process. */
export function rankedMatchMaxAgeHours(): number {
  const raw = process.env.RANKED_MATCH_MAX_AGE_HOURS;
  if (raw == null || raw.trim() === "") return DEFAULT_MATCH_MAX_AGE_HOURS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MATCH_MAX_AGE_HOURS;
  return parsed;
}
