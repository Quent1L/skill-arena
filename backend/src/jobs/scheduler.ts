import { withAdvisoryLock } from './advisory-lock';
import { autoFinalizeMatchesJob } from './auto-finalize-matches.job';
import { getPool } from '../config/database';
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

  logger.info('[Scheduler] Bun.cron started (auto-finalize every hour at :00)');
  return job;
}
