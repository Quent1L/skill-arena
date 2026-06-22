import { withAdvisoryLock } from './advisory-lock';
import { autoFinalizeMatchesJob } from './auto-finalize-matches.job';
import { getPool } from '../config/database';
import { enqueueBadgeReconciliation } from '../services/mmr-job-queue.service';
import { logger } from '../utils/logger';

const LOCK_KEYS = {
  AUTO_FINALIZE: 1,
} as const;

export function startJobScheduler(): { stop(): void } {
  const job = Bun.cron('0 * * * *', async () => {
    try {
      const lockResult = await withAdvisoryLock(
        getPool(),
        LOCK_KEYS.AUTO_FINALIZE,
        () => autoFinalizeMatchesJob()
      );
      if (!lockResult.ran) {
        logger.info('[Scheduler] auto-finalize skipped — lock held by another instance');
      }
    } catch (err) {
      logger.error({ err }, '[Scheduler] auto-finalize error');
    } finally {
      Bun.gc(true);
    }
  });

  // Nightly badge reconciliation: enqueue a worker job (deduped by job key).
  // The worker only runs a full recompute if a badge rule changed (dirty flag).
  const badgeJob = Bun.cron('0 3 * * *', async () => {
    try {
      await enqueueBadgeReconciliation(false);
      logger.info('[Scheduler] nightly badge reconciliation enqueued');
    } catch (err) {
      logger.error({ err }, '[Scheduler] badge reconciliation enqueue error');
    }
  });

  logger.info('[Scheduler] Bun.cron started (auto-finalize hourly, badge reconciliation nightly at 03:00)');
  return {
    stop() {
      job.stop();
      badgeJob.stop();
    },
  };
}
