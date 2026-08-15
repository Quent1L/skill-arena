/**
 * One-shot migration for the MMR engine rewrite: queues a full deterministic
 * recalculation of every ranked season still running.
 *
 * The engine no longer prices a match the same way (team delta split into
 * normalised shares instead of a per-player ratio), so MMR computed by the old
 * formula is not comparable with what a new match will produce. Ongoing seasons
 * are replayed to make the whole ladder consistent again.
 *
 * Finished seasons are deliberately left alone: their standings are published,
 * their rewinds are frozen by version, and the carry-over seeds derived from
 * them are already stored.
 *
 * Run from the repo root, with the backend env loaded:
 *   bun run scripts/recalc-ongoing-ranked.ts
 */
import { eq, and } from "drizzle-orm";
import { db } from "../backend/src/config/database";
import { tournaments } from "../backend/src/db/schema";
import { enqueueMmrSeasonRecalculation } from "../backend/src/services/mmr-job-queue.service";

async function main(): Promise<void> {
  const seasons = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(and(eq(tournaments.mode, "ranked"), eq(tournaments.status, "ongoing")));

  if (seasons.length === 0) {
    console.log("No ongoing ranked season — nothing to recalculate.");
    return;
  }

  for (const season of seasons) {
    await enqueueMmrSeasonRecalculation(season.id);
    console.log(`queued recalculate_season_mmr  ${season.id}  ${season.name}`);
  }

  console.log(`\n${seasons.length} season(s) queued. The MMR worker replays them one by one.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
