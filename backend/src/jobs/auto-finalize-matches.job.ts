import { matchService } from "../services/match.service";
import { logger } from "../utils/logger";

/**
 * Job to auto-finalize matches after 72h deadline
 * This should be run periodically (e.g., every hour) by a cron scheduler
 */
export async function autoFinalizeMatchesJob() {
  try {
    logger.info("[Auto-finalize] Starting auto-finalization job...");
    
    const result = await matchService.autoFinalizeExpiredMatches();
    
    logger.info(`[Auto-finalize] Job completed:`, {
      total: result.total,
      finalized: result.finalized.length,
      disputed: result.disputed.length,
    });
    
    return result;
  } catch (error) {
    logger.error("[Auto-finalize] Error during auto-finalization:", error);
    throw error;
  }
}

/**
 * Run the job immediately (for testing or manual trigger)
 */
if (import.meta.main) {
  logger.info("Running auto-finalize matches job manually...");
  autoFinalizeMatchesJob()
    .then((result) => {
      logger.info("Job completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Job failed:", error);
      process.exit(1);
    });
}

