import {
  createTestDatabase,
  closeTestDatabase,
} from "./src/config/test-database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./src/db/schema";
import { randomUUID } from "crypto";

console.log("Creating test database...");
const testDb: PgliteDatabase<typeof schema> = await createTestDatabase();
console.log("Test database created");

console.log("Importing matchService...");
const { matchService } = await import("./src/services/match.service");
console.log("matchService imported, type:", typeof matchService);
console.log(
  "matchService methods:",
  Object.getOwnPropertyNames(Object.getPrototypeOf(matchService)),
);

// Create test data first
console.log("\nCreating test user...");
const timestamp = Date.now();
const {
  user: betterAuthUser,
  appUsers,
  tournaments,
  tournamentParticipants,
} = await import("./src/db/schema");

const [authUser] = await testDb
  .insert(betterAuthUser)
  .values({
    id: `test-auth-${timestamp}`,
    name: "Test User",
    email: `test-${timestamp}@test.com`,
    emailVerified: true,
  })
  .returning();

const [appUser] = await testDb
  .insert(appUsers)
  .values({
    externalId: authUser.id,
    displayName: "Test User",
    role: "player",
  })
  .returning();
console.log("Created user:", appUser.id);

// Create tournament
console.log("Creating tournament...");
const [tournament] = await testDb
  .insert(tournaments)
  .values({
    id: randomUUID(),
    name: "Test Tournament",
    createdBy: appUser.id,
    teamMode: "flex",
    mode: "championship",
    status: "open",
    minTeamSize: 1,
    maxTeamSize: 2,
    maxMatchesPerPlayer: 10,
    maxTimesWithSamePartner: 2,
    maxTimesWithSameOpponent: 10,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  })
  .returning();
console.log("Created tournament:", tournament.id);

// Add participant
await testDb.insert(tournamentParticipants).values({
  tournamentId: tournament.id,
  userId: appUser.id,
});

// Try to create a match
console.log("\nTesting matchService.createMatch...");
console.log("With tournamentId:", tournament.id);
console.log("With playerIdsA:", [appUser.id]);
console.log("With playerIdsB:", [appUser.id]);

// Instead of createMatch, let's test the pieces
const { matchRepository } = await import("./src/repository/match.repository");

console.log("\nTesting matchRepository.getTournament...");
const tournamentResult = await matchRepository.getTournament(tournament.id);
console.log(
  "Tournament from repo:",
  tournamentResult ? tournamentResult.name : "NOT FOUND",
);

// Now create a second player to have a proper match
console.log("\nCreating second player...");
const [authUser2] = await testDb
  .insert(betterAuthUser)
  .values({
    id: `test-auth2-${timestamp}`,
    name: "Test User 2",
    email: `test2-${timestamp}@test.com`,
    emailVerified: true,
  })
  .returning();

const [appUser2] = await testDb
  .insert(appUsers)
  .values({
    externalId: authUser2.id,
    displayName: "Test User 2",
    role: "player",
  })
  .returning();
console.log("Created user 2:", appUser2.id);

// Add second participant
await testDb.insert(tournamentParticipants).values({
  tournamentId: tournament.id,
  userId: appUser2.id,
});

// Test individual validators before calling createMatch
const { matchInputValidator } =
  await import("./src/services/validators/match-input.validator");
const { matchPermissionValidator } =
  await import("./src/services/validators/match-permission.validator");
const { matchRuleValidator } =
  await import("./src/services/validators/match-rule.validator");

const createInput = {
  tournamentId: tournament.id,
  playerIdsA: [appUser.id],
  playerIdsB: [appUser2.id],
  status: "scheduled" as const,
};

console.log("\n--- Testing individual validators ---");

console.log("1. Testing matchPermissionValidator.checkCreatePermissions...");
try {
  await matchPermissionValidator.checkCreatePermissions(
    createInput,
    appUser.id,
    tournamentResult!,
  );
  console.log("   PASSED");
} catch (e) {
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("2. Testing matchInputValidator.validateMatchInput...");
try {
  await matchInputValidator.validateMatchInput(createInput, tournamentResult!);
  console.log("   PASSED");
} catch (e) {
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("3. Testing matchRuleValidator.validateMatchRules...");
try {
  await matchRuleValidator.validateMatchRules(createInput, tournamentResult!);
  console.log("   PASSED");
} catch (e) {
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("\n4. Testing matchRepository.create...");
console.log("   Starting transaction...");

// Let's test individual steps
const { db } = await import("./src/config/database");
const { matches, matchSides, tournamentEntries, tournamentEntryPlayers } =
  await import("./src/db/schema");
const { eq } = await import("drizzle-orm");

console.log("4.1 Testing db.insert without transaction...");
try {
  const [match] = await db
    .insert(matches)
    .values({
      tournamentId: tournament.id,
      status: "scheduled",
      playedAt: new Date(),
    })
    .returning();
  console.log("   Match created:", match.id);

  // Clean up
  await db.delete(matches).where(eq(matches.id, match.id));
  console.log("   Match deleted");
} catch (e) {
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("4.2 Testing db.transaction...");
try {
  const result = await db.transaction(async (tx) => {
    console.log("   Inside transaction");
    const [match] = await tx
      .insert(matches)
      .values({
        tournamentId: tournament.id,
        status: "scheduled",
        playedAt: new Date(),
      })
      .returning();
    console.log("   Match created in tx:", match.id);
    return match.id;
  });
  console.log("   Transaction completed with result:", result);

  // Clean up
  await db.delete(matches).where(eq(matches.id, result));
  console.log("   Match deleted");
} catch (e) {
  console.log("   Error:", e instanceof Error ? e.message : e);
}

console.log("\nClosing database...");
await closeTestDatabase();
console.log("Done");
process.exit(0);
