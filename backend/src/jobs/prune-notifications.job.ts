import { notificationRepository } from "../repository/notification.repository";
import { logger } from "../utils/logger";

/** How long a settled notification is kept before the nightly sweep drops it. */
export const NOTIFICATION_RETENTION_DAYS = 90;

const BATCH_SIZE = 5000;
/** A guard, not a target: the sweep is nightly, so it never has this much to do. */
const MAX_BATCHES = 100;

/**
 * Drops notifications that are read, ask for nothing still owed, and are older than the
 * retention window. Batched so a backlog never holds a lock over the whole table.
 */
export async function pruneNotificationsJob(retentionDays = NOTIFICATION_RETENTION_DAYS) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  logger.info({ cutoff }, "[Prune-notifications] Starting retention sweep...");

  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const removed = await notificationRepository.deleteReadOlderThan(cutoff, BATCH_SIZE);
    deleted += removed;
    if (removed < BATCH_SIZE) break;
  }

  logger.info({ deleted, retentionDays }, "[Prune-notifications] Sweep completed");
  return { deleted };
}

if (import.meta.main) {
  pruneNotificationsJob()
    .then((result) => {
      logger.info({ result }, "Job completed successfully:");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ err: error }, "Job failed:");
      process.exit(1);
    });
}
