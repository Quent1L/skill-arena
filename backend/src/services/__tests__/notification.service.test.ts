/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import { notificationService } from "../notification.service";
import { notificationActionService } from "../notification-action.service";
import { notificationRepository } from "../../repository/notification.repository";
import { BadRequestError, ErrorCode, type AppError } from "../../types/errors";

const blocking = {
  id: "n-1",
  userId: "u-1",
  type: "MATCH_POST_DISPUTE",
  requiresAction: true,
  matchId: "m-1",
  titleKey: "notifications.MATCH_POST_DISPUTE_TITLE",
  messageKey: "notifications.MATCH_POST_DISPUTE_MESSAGE",
  translationParams: {},
};

let deleted: Array<[string, string]> = [];
let pendingIds: string[] = [];

beforeEach(() => {
  deleted = [];
  pendingIds = ["n-1"];
  (notificationRepository as any).getById = async () => blocking;
  (notificationRepository as any).getStatus = async () => ({ actionCompleted: false });
  (notificationRepository as any).delete = async (id: string, userId: string) => {
    deleted.push([id, userId]);
  };
  (notificationActionService as any).resolvePendingActions = async () =>
    new Set(pendingIds);
});

afterEach(() => {
  const restore = (instance: object) => {
    for (const key of Object.getOwnPropertyNames(instance)) {
      delete (instance as Record<string, unknown>)[key];
    }
  };
  restore(notificationRepository);
  restore(notificationActionService);
});

describe("NotificationService.delete", () => {
  it("refuses to drop a notification whose action is still owed", async () => {
    try {
      await notificationService.delete("n-1", "u-1");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
      expect((err as AppError).code).toBe(ErrorCode.NOTIFICATION_ACTION_PENDING);
    }
    expect(deleted).toHaveLength(0);
  });

  it("lets it go once the situation it pointed at is settled", async () => {
    pendingIds = [];

    await notificationService.delete("n-1", "u-1");

    expect(deleted).toEqual([["n-1", "u-1"]]);
  });

  it("lets it go when the recipient marked the action completed", async () => {
    (notificationRepository as any).getStatus = async () => ({ actionCompleted: true });

    await notificationService.delete("n-1", "u-1");

    expect(deleted).toEqual([["n-1", "u-1"]]);
  });

  it("never gets in the way of an ordinary notification", async () => {
    (notificationRepository as any).getById = async () => ({
      ...blocking,
      requiresAction: false,
    });
    (notificationRepository as any).getStatus = async () => {
      throw new Error("should not be consulted");
    };

    await notificationService.delete("n-1", "u-1");

    expect(deleted).toEqual([["n-1", "u-1"]]);
  });
});

describe("NotificationService.getForUser", () => {
  it("stamps each actionable notification with whether its action is settled", async () => {
    (notificationRepository as any).getForUser = async () => [
      { ...blocking, id: "n-1", isRead: false, actionCompleted: false, createdAt: new Date() },
      { ...blocking, id: "n-2", isRead: false, actionCompleted: false, createdAt: new Date() },
      {
        ...blocking,
        id: "n-3",
        requiresAction: false,
        isRead: false,
        actionCompleted: false,
        createdAt: new Date(),
      },
    ];
    pendingIds = ["n-1"];

    const list = await notificationService.getForUser("u-1");

    expect(list.map((n) => [n.id, n.actionResolved])).toEqual([
      ["n-1", false],
      ["n-2", true],
      ["n-3", false],
    ]);
    // The wire shape stays the documented one: no match id, no raw type
    expect(list[0]).not.toHaveProperty("matchId");
    expect(list[0]).not.toHaveProperty("type");
  });
});
