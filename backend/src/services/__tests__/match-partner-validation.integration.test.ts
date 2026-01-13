import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../../config/database";
import { matchService } from "../match.service";
import { entryRepository } from "../../repository/entry.repository";
import { matchRepository } from "../../repository/match.repository";
import {
  tournaments,
  appUsers,
  user as betterAuthUser,
  tournamentParticipants,
  matches,
  matchSides,
  tournamentEntries,
  tournamentEntryPlayers,
} from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { ConflictError, ErrorCode } from "../../types/errors";
import { randomUUID } from "crypto";

describe("Match Partner Validation", () => {
  let tournamentId: string;
  let player1Id: string;
  let player2Id: string;
  let player3Id: string;
  let player4Id: string;
  let authUser1Id: string;
  let authUser2Id: string;
  let authUser3Id: string;
  let authUser4Id: string;

  beforeAll(async () => {
    // Generate valid UUID for tournament
    tournamentId = randomUUID();

    const timestamp = Date.now();

    // Create Better Auth users first
    const [authUser1] = await db
      .insert(betterAuthUser)
      .values({
        id: `test-auth-1-${timestamp}`,
        name: "Player 1",
        email: `player1-${timestamp}@test.com`,
        emailVerified: true,
      })
      .returning();
    authUser1Id = authUser1.id;

    const [authUser2] = await db
      .insert(betterAuthUser)
      .values({
        id: `test-auth-2-${timestamp}`,
        name: "Player 2",
        email: `player2-${timestamp}@test.com`,
        emailVerified: true,
      })
      .returning();
    authUser2Id = authUser2.id;

    const [authUser3] = await db
      .insert(betterAuthUser)
      .values({
        id: `test-auth-3-${timestamp}`,
        name: "Player 3",
        email: `player3-${timestamp}@test.com`,
        emailVerified: true,
      })
      .returning();
    authUser3Id = authUser3.id;

    const [authUser4] = await db
      .insert(betterAuthUser)
      .values({
        id: `test-auth-4-${timestamp}`,
        name: "Player 4",
        email: `player4-${timestamp}@test.com`,
        emailVerified: true,
      })
      .returning();
    authUser4Id = authUser4.id;

    // Create app users
    const [user1] = await db
      .insert(appUsers)
      .values({
        externalId: authUser1Id,
        displayName: "Player 1",
        role: "player",
      })
      .returning();
    player1Id = user1.id;

    const [user2] = await db
      .insert(appUsers)
      .values({
        externalId: authUser2Id,
        displayName: "Player 2",
        role: "player",
      })
      .returning();
    player2Id = user2.id;

    const [user3] = await db
      .insert(appUsers)
      .values({
        externalId: authUser3Id,
        displayName: "Player 3",
        role: "player",
      })
      .returning();
    player3Id = user3.id;

    const [user4] = await db
      .insert(appUsers)
      .values({
        externalId: authUser4Id,
        displayName: "Player 4",
        role: "player",
      })
      .returning();
    player4Id = user4.id;

    // Create tournament with flex mode
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await db
      .insert(tournaments)
      .values({
        id: tournamentId,
        name: "Test Tournament Partner Validation",
        createdBy: player1Id,
        teamMode: "flex",
        mode: "championship",
        status: "open",
        minTeamSize: 1,
        maxTeamSize: 2,
        maxMatchesPerPlayer: 10,
        maxTimesWithSamePartner: 2, // Allow max 2 matches with same partner
        maxTimesWithSameOpponent: 10,
        startDate: today,
        endDate: nextWeek,
      });

    // Add participants
    await db.insert(tournamentParticipants).values([
      { tournamentId, userId: player1Id },
      { tournamentId, userId: player2Id },
      { tournamentId, userId: player3Id },
      { tournamentId, userId: player4Id },
    ]);
  });


  afterAll(async () => {
    // Clean up - delete in reverse dependency order
    await db
      .delete(matchSides)
      .where(
        inArray(
          matchSides.matchId,
          db
            .select({ id: matches.id })
            .from(matches)
            .where(eq(matches.tournamentId, tournamentId))
        )
      );

    await db.delete(matches).where(eq(matches.tournamentId, tournamentId));

    await db
      .delete(tournamentEntryPlayers)
      .where(
        inArray(
          tournamentEntryPlayers.entryId,
          db
            .select({ id: tournamentEntries.id })
            .from(tournamentEntries)
            .where(eq(tournamentEntries.tournamentId, tournamentId))
        )
      );

    await db
      .delete(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId));

    await db
      .delete(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    await db.delete(tournaments).where(eq(tournaments.id, tournamentId));

    await db
      .delete(appUsers)
      .where(
        inArray(appUsers.id, [player1Id, player2Id, player3Id, player4Id])
      );

    await db
      .delete(betterAuthUser)
      .where(
        inArray(betterAuthUser.id, [
          authUser1Id,
          authUser2Id,
          authUser3Id,
          authUser4Id,
        ])
      );
  });

  it("Step 1: should count matches correctly after creating first match", async () => {
    // Create first match: Player1 + Player2 vs Player3 + Player4
    await matchService.createMatch(
      {
        tournamentId,
        playerIdsA: [player1Id, player2Id],
        playerIdsB: [player3Id, player4Id],
        status: "scheduled",
      },
      player1Id
    );

    // Check that entry was created for Player1 + Player2
    const entry12 = await entryRepository.findExistingEntry(
      tournamentId,
      undefined,
      [player1Id, player2Id]
    );
    expect(entry12).toBeTruthy();

    // Count matches where Player1 and Player2 played together
    const count = await matchRepository.countMatchesWithSamePartner(
      tournamentId,
      player1Id,
      player2Id,
      undefined,
      2 // team size
    );

    expect(Number(count)).toBe(1);
  });

  it("Step 2: should count matches correctly after creating second match", async () => {
    // Create second match: Player1 + Player2 vs Player3 + Player4
    await matchService.createMatch(
      {
        tournamentId,
        playerIdsA: [player1Id, player2Id],
        playerIdsB: [player3Id, player4Id],
        status: "scheduled",
      },
      player1Id
    );

    // Count matches where Player1 and Player2 played together (should be 2 now)
    const count = await matchRepository.countMatchesWithSamePartner(
      tournamentId,
      player1Id,
      player2Id,
      undefined,
      2 // team size
    );

    expect(Number(count)).toBe(2);
  });

  it("should prevent creating third match with same partners when limit is 2", async () => {
    // Try to create third match: Player1 + Player2 vs Player3 + Player4
    // This should fail because maxTimesWithSamePartner is 2

    try {
      await matchService.createMatch(
        {
          tournamentId,
          playerIdsA: [player1Id, player2Id],
          playerIdsB: [player3Id, player4Id],
          status: "scheduled",
        },
        player1Id
      );
      throw new Error("Expected ConflictError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe(
        ErrorCode.MAX_PARTNER_MATCHES_EXCEEDED
      );
    }
  });

  it("should validate match correctly - returns errors when partner limit exceeded", async () => {
    // Validate match creation (should fail)
    const validation = await matchService.validateMatch({
      tournamentId,
      playerIdsA: [player1Id, player2Id],
      playerIdsB: [player3Id, player4Id],
      status: "scheduled",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toContain("Player 1");
    expect(validation.errors[0]).toContain("Player 2");
  });

  it("should not create duplicate entries during validation", async () => {
    // Get entries before validation
    const entriesBefore = await db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId));

    const countBefore = entriesBefore.length;

    // Validate match multiple times
    await matchService.validateMatch({
      tournamentId,
      playerIdsA: [player1Id, player3Id],
      playerIdsB: [player2Id, player4Id],
      status: "scheduled",
    });

    await matchService.validateMatch({
      tournamentId,
      playerIdsA: [player1Id, player3Id],
      playerIdsB: [player2Id, player4Id],
      status: "scheduled",
    });

    // Get entries after validation
    const entriesAfter = await db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, tournamentId));

    const countAfter = entriesAfter.length;

    // Count should be the same - validation should not create entries
    expect(countAfter).toBe(countBefore);
  });

  it("should allow creating match with different partner combination", async () => {
    // Create match: Player1 + Player3 vs Player2 + Player4
    // This should succeed because Player1 hasn't played with Player3 before
    const match = await matchService.createMatch(
      {
        tournamentId,
        playerIdsA: [player1Id, player3Id],
        playerIdsB: [player2Id, player4Id],
        status: "scheduled",
      },
      player1Id
    );

    expect(match).toBeTruthy();
    expect(match?.id).toBeTruthy();

    // Verify entry was created (or found existing)
    const entry13 = await entryRepository.findExistingEntry(
      tournamentId,
      undefined,
      [player1Id, player3Id]
    );
    expect(entry13).toBeTruthy();

    // Count matches where Player1 and Player3 played together
    const count = await matchRepository.countMatchesWithSamePartner(
      tournamentId,
      player1Id,
      player3Id,
      undefined,
      2 // team size
    );

    expect(Number(count)).toBe(1);
  });

  it("Step 7: should count opponent matches correctly - Player1 vs Player3", async () => {
    // At this point, we have:
    // - Match 1: Player1+Player2 vs Player3+Player4
    // - Match 2: Player1+Player2 vs Player3+Player4
    // - Match 3: Player1+Player3 vs Player2+Player4

    // Count matches where Player1 played against Player3
    const count = await matchRepository.countMatchesWithSameOpponent(
      tournamentId,
      player1Id,
      player3Id,
      undefined,
      2 // team size
    );

    // Player1 played against Player3 in 2 matches (Match 1 and Match 2)
    // In Match 3, they are partners, not opponents
    expect(Number(count)).toBe(2);
  });

  it("Step 8: should not count partner matches as opponent matches", async () => {
    // Count matches where Player1 played against Player2
    const count = await matchRepository.countMatchesWithSameOpponent(
      tournamentId,
      player1Id,
      player2Id,
      undefined,
      2 // team size
    );

    // Player1 and Player2 were partners in Match 1 and Match 2,
    // and opponents in Match 3
    expect(Number(count)).toBe(1);
  });

  it("Step 9: should prevent creating match when opponent limit exceeded", async () => {
    // Try to create a third match: Player1+Player4 vs Player3+Player2
    // This should fail because Player1 has already played against Player3 twice
    // and maxTimesWithSameOpponent is 2 (set to 10 but let's assume it was 2)

    // First, update tournament settings to have lower opponent limit
    await db
      .update(tournaments)
      .set({ maxTimesWithSameOpponent: 2 })
      .where(eq(tournaments.id, tournamentId));

    try {
      await matchService.createMatch(
        {
          tournamentId,
          playerIdsA: [player1Id, player4Id],
          playerIdsB: [player3Id, player2Id],
          status: "scheduled",
        },
        player1Id
      );
      throw new Error("Expected ConflictError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe(
        ErrorCode.MAX_OPPONENT_MATCHES_EXCEEDED
      );
    }
  });
});
