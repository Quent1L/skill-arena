import { autoFinalizeMatchesJob } from "./auto-finalize-matches.job";
import { logger } from "../utils/logger";

/**
 * CRON Scheduler for periodic tasks
 * Runs auto-finalization job every hour
 */
export class JobScheduler {
  private intervalId: Timer | null = null;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Start the scheduler
   */
  start() {
    if (this.intervalId) {
      logger.info("[Scheduler] Already running");
      return;
    }

    logger.info("[Scheduler] Starting job scheduler...");
    logger.info(`[Scheduler] Auto-finalize job will run every ${this.INTERVAL_MS / 1000 / 60} minutes`);

    // Run immediately on start
    this.runAutoFinalizeJob();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.runAutoFinalizeJob();
    }, this.INTERVAL_MS);

    logger.info("[Scheduler] Job scheduler started successfully");
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("[Scheduler] Job scheduler stopped");
    }
  }

  /**
   * Run auto-finalize job with error handling and garbage collection
   */
  private async runAutoFinalizeJob() {
    try {
      await autoFinalizeMatchesJob();
    } catch (error) {
      logger.error({ err: error }, "[Scheduler] Error running auto-finalize job:");
    } finally {
      // Force garbage collection to release memory and compact heap
      if (typeof Bun !== 'undefined' && Bun.gc) {
        Bun.gc(true);
      }
    }
  }
}

export const jobScheduler = new JobScheduler();
