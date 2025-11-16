import { matchService } from "../services/match.service";

/**
 * Job to auto-finalize matches after 72h deadline
 * This should be run periodically (e.g., every hour) by a cron scheduler
 */
export async function autoFinalizeMatchesJob() {
  try {
    console.log("[Auto-finalize] Starting auto-finalization job...");
    
    const result = await matchService.autoFinalizeExpiredMatches();
    
    console.log(`[Auto-finalize] Job completed:`, {
      total: result.total,
      finalized: result.finalized.length,
      disputed: result.disputed.length,
    });
    
    return result;
  } catch (error) {
    console.error("[Auto-finalize] Error during auto-finalization:", error);
    throw error;
  }
}

/**
 * Run the job immediately (for testing or manual trigger)
 */
if (import.meta.main) {
  console.log("Running auto-finalize matches job manually...");
  autoFinalizeMatchesJob()
    .then((result) => {
      console.log("Job completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Job failed:", error);
      process.exit(1);
    });
}

