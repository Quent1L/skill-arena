import { BracketsManager } from "brackets-manager";
import { BracketsStorage } from "./brackets-storage";
import { BracketParticipant } from "../types/bracket";
import { Seeding } from "brackets-model";
import { db } from "../config/database";
import { stages, groups, rounds, matches, matchGames } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

const storage = new BracketsStorage();
const manager = new BracketsManager(storage);

export class BracketGeneratorService {
  /**
   * Generate bracket for a tournament using BracketsManager
   */
  async generateBracket(
    tournamentId: string,
    participants: BracketParticipant[],
    bracketType: "single" | "double"
  ) {
    // Convert participants to Seeding format
    // Seeding expected: (string | null)[] (names) or objects
    // We want to pass team IDs if possible, but the library might expect names for display.
    // The storage adapter handles 'participant' table inserts.
    // When creating a stage, we pass 'seeding'.
    
    // We pass objects with name and extra info (id)
    const seeding: Seeding = participants.map((p) => ({
      id: p.teamId, // Pass ID to be stored
      name: p.name,
      seed: p.seed
    }));

    // Determine stage type
    const stageType =
      bracketType === "single" ? "single_elimination" : "double_elimination";

    // Create the stage
    await manager.create.stage({
      tournamentId: tournamentId,
      name: "Main Event",
      type: stageType,
      seeding,
      settings: {
        seedOrdering: ["inner_outer"], // Standard seeding
        grandFinal: bracketType === "double" ? "simple" : undefined, // Simple grand final for DE
        consolationFinal: false,
        size: participants.length,
      },
    });

    // We don't need to return matches manually, they are stored in DB.
    // The storage adapter handles returning IDs (though we mocked it slightly).
  }

  /**
   * Get bracket data for viewer
   */
  async getBracketData(tournamentId: string) {
    const data = await manager.get.tournamentData(tournamentId);
    
    // Debug logging
    console.log(`[BracketGenerator] Fetched data for ${tournamentId}`);
    console.log(`- Stages: ${data.stage?.length}`);
    console.log(`- Matches: ${data.match?.length}`);
    console.log(`- Groups: ${data.group?.length}`);
    console.log(`- Rounds: ${data.round?.length}`);
    
    if (data.match?.length > 0) {
        console.log(`[BracketGenerator] Sample match keys:`, Object.keys(data.match[0]));
        console.log(`[BracketGenerator] Sample match stage_id:`, data.match[0].stage_id);
    } else {
        console.log(`[BracketGenerator] No matches found!`);
    }

    return data;
  }

  /**
   * Clean up all bracket data for a tournament (stages, groups, rounds, matches, match_games)
   */
  async cleanupBracketData(tournamentId: string): Promise<void> {
    const tournamentStages = await db.select({ id: stages.id })
      .from(stages)
      .where(eq(stages.tournamentId, tournamentId));

    if (tournamentStages.length === 0) return;

    const stageIds = tournamentStages.map(s => s.id);

    // Delete in order: match_games -> matches -> rounds -> groups -> stages
    await db.delete(matchGames).where(inArray(matchGames.stageId, stageIds));
    await db.delete(matches).where(eq(matches.tournamentId, tournamentId));
    await db.delete(rounds).where(inArray(rounds.stageId, stageIds));
    await db.delete(groups).where(inArray(groups.stageId, stageIds));
    await db.delete(stages).where(eq(stages.tournamentId, tournamentId));

    console.log(`[BracketGenerator] Cleaned up bracket data for tournament ${tournamentId}`);
  }

  /**
   * Check if tournament has any bracket data (stages)
   */
  async hasBracketData(tournamentId: string): Promise<boolean> {
    const tournamentStages = await db.select({ id: stages.id })
      .from(stages)
      .where(eq(stages.tournamentId, tournamentId));
    return tournamentStages.length > 0;
  }
}

export const bracketGeneratorService = new BracketGeneratorService();

