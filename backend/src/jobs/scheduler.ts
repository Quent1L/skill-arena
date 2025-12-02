import { autoFinalizeMatchesJob } from "./auto-finalize-matches.job";

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
      console.log("[Scheduler] Already running");
      return;
    }

    console.log("[Scheduler] Starting job scheduler...");
    console.log(`[Scheduler] Auto-finalize job will run every ${this.INTERVAL_MS / 1000 / 60} minutes`);

    // Run immediately on start
    this.runAutoFinalizeJob();

    // Then run every hour
    this.intervalId = setInterval(() => {
      this.runAutoFinalizeJob();
    }, this.INTERVAL_MS);

    console.log("[Scheduler] Job scheduler started successfully");
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Scheduler] Job scheduler stopped");
    }
  }

  /**
   * Run auto-finalize job with error handling
   */
  private async runAutoFinalizeJob() {
    try {
      await autoFinalizeMatchesJob();
    } catch (error) {
      console.error("[Scheduler] Error running auto-finalize job:", error);
    }
  }
}

export const jobScheduler = new JobScheduler();
