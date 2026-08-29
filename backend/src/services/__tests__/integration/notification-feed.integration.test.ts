import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test";
import { createTestDatabase, closeTestDatabase } from "../../../config/test-database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema";

// Initialize the test database BEFORE any imports that use `db`.
const testDb: PgliteDatabase<typeof schema> = await createTestDatabase();

import { notificationRepository } from "../../../repository/notification.repository";
import { pruneNotificationsJob } from "../../../jobs/prune-notifications.job";
import { appUsers, user as betterAuthUser, notifications, notificationStatus } from "../../../db/schema";

describe("Notification feed (integration)", () => {
  let userId: string;
  let otherUserId: string;

  async function createUser(name: string) {
    const suffix = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [authUser] = await testDb
      .insert(betterAuthUser)
      .values({ id: `auth-${suffix}`, name, email: `${suffix}@example.com`, emailVerified: true })
      .returning();
    const [appUser] = await testDb
      .insert(appUsers)
      .values({
        displayName: name,
        shortName: name.slice(0, 3).toUpperCase(),
        externalId: authUser.id,
        role: "player",
      })
      .returning();
    return appUser.id;
  }

  /** Seeds one notification plus the recipient's copy of its state. */
  async function seed(
    owner: string,
    options: {
      createdAt: Date;
      read?: boolean;
      requiresAction?: boolean;
      actionCompleted?: boolean;
    },
  ) {
    const [notification] = await testDb
      .insert(notifications)
      .values({
        userId: owner,
        type: "MATCH_MESSAGE",
        titleKey: "notifications.MATCH_MESSAGE_TITLE",
        messageKey: "notifications.MATCH_MESSAGE_MESSAGE",
        requiresAction: options.requiresAction ?? false,
        createdAt: options.createdAt,
      })
      .returning();

    await testDb.insert(notificationStatus).values({
      notificationId: notification.id,
      userId: owner,
      read: options.read ?? false,
      actionCompleted: options.actionCompleted ?? false,
    });

    return notification.id;
  }

  beforeAll(async () => {
    userId = await createUser("Feed");
    otherUserId = await createUser("Other");
  });

  beforeEach(async () => {
    await testDb.delete(notificationStatus);
    await testDb.delete(notifications);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it("walks the feed newest first, one page at a time", async () => {
    const base = new Date("2026-08-01T10:00:00.000Z");
    for (let i = 0; i < 5; i++) {
      await seed(userId, { createdAt: new Date(base.getTime() + i * 60_000) });
    }

    const first = await notificationRepository.getPageForUser(userId, 2);
    expect(first).toHaveLength(2);
    expect(first[0].createdAt.getTime()).toBeGreaterThan(first[1].createdAt.getTime());

    const second = await notificationRepository.getPageForUser(userId, 2, {
      createdAt: first[1].createdAt,
      id: first[1].id,
    });
    expect(second).toHaveLength(2);
    expect(second.map((r) => r.id)).not.toContain(first[0].id);
    expect(second[0].createdAt.getTime()).toBeLessThan(first[1].createdAt.getTime());
  });

  it("breaks ties on the id so a shared timestamp never repeats or skips a row", async () => {
    const sameInstant = new Date("2026-08-01T10:00:00.000Z");
    for (let i = 0; i < 4; i++) await seed(userId, { createdAt: sameInstant });

    const seen: string[] = [];
    let cursor: { createdAt: Date; id: string } | undefined;
    for (let page = 0; page < 4; page++) {
      const rows = await notificationRepository.getPageForUser(userId, 2, cursor);
      if (rows.length === 0) break;
      seen.push(...rows.map((r) => r.id));
      const last = rows[rows.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };
    }

    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });

  it("never serves another user's notifications", async () => {
    await seed(otherUserId, { createdAt: new Date("2026-08-01T10:00:00.000Z") });
    await seed(userId, { createdAt: new Date("2026-08-01T10:00:00.000Z") });

    const rows = await notificationRepository.getPageForUser(userId, 20);

    expect(rows).toHaveLength(1);
    expect(await notificationRepository.countForUser(userId)).toEqual({ total: 1, unread: 1 });
  });

  it("marks the whole feed read in one statement", async () => {
    const base = new Date("2026-08-01T10:00:00.000Z");
    await seed(userId, { createdAt: base });
    await seed(userId, { createdAt: base, read: true });
    await seed(otherUserId, { createdAt: base });

    expect(await notificationRepository.markAllAsRead(userId)).toBe(1);
    expect(await notificationRepository.countForUser(userId)).toEqual({ total: 2, unread: 0 });
    // The other recipient is untouched
    expect(await notificationRepository.countForUser(otherUserId)).toEqual({ total: 1, unread: 1 });
  });

  it("clears the feed in one go while keeping what it is told to keep", async () => {
    const base = new Date("2026-08-01T10:00:00.000Z");
    const kept = await seed(userId, { createdAt: base, requiresAction: true });
    await seed(userId, { createdAt: base });
    await seed(userId, { createdAt: base });
    await seed(otherUserId, { createdAt: base });

    expect(await notificationRepository.deleteAllForUser(userId, [kept])).toBe(2);

    const left = await notificationRepository.getPageForUser(userId, 20);
    expect(left.map((r) => r.id)).toEqual([kept]);
    // The rows themselves are gone, not just the recipient's copy
    expect(await testDb.select().from(notifications)).toHaveLength(2);
    expect(await notificationRepository.countForUser(otherUserId)).toEqual({ total: 1, unread: 1 });
  });

  it("keeps everything when every notification is still owed", async () => {
    const base = new Date("2026-08-01T10:00:00.000Z");
    const kept = await seed(userId, { createdAt: base, requiresAction: true });

    expect(await notificationRepository.deleteAllForUser(userId, [kept])).toBe(0);
    expect(await notificationRepository.getPageForUser(userId, 20)).toHaveLength(1);
  });

  it("lists only the actions that are neither settled nor completed", async () => {
    const base = new Date("2026-08-01T10:00:00.000Z");
    const owed = await seed(userId, { createdAt: base, requiresAction: true });
    await seed(userId, { createdAt: base, requiresAction: true, actionCompleted: true });
    await seed(userId, { createdAt: base });

    const unsettled = await notificationRepository.getUnsettledActionsForUser(userId);

    expect(unsettled.map((n) => n.id)).toEqual([owed]);
  });

  it("prunes read, settled notifications past the retention window", async () => {
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seed(userId, { createdAt: old, read: true });
    const unreadOld = await seed(userId, { createdAt: old });
    const owedOld = await seed(userId, { createdAt: old, read: true, requiresAction: true });
    const young = await seed(userId, { createdAt: recent, read: true });

    const { deleted } = await pruneNotificationsJob(90);

    expect(deleted).toBe(1);
    const left = await notificationRepository.getPageForUser(userId, 20);
    expect(left.map((r) => r.id).sort()).toEqual([owedOld, unreadOld, young].sort());
  });
});
