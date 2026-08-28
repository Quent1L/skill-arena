import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/database";
import { notifications, notificationStatus } from "../db/schema";
import { CreateNotification } from "@skol-arena/shared";

export const notificationRepository = {
  async create(data: CreateNotification) {
    return await db.transaction(async (tx) => {
      const [notification] = await tx
        .insert(notifications)
        .values({
          userId: data.userId,
          type: data.type,
          titleKey: data.titleKey,
          messageKey: data.messageKey,
          translationParams: data.translationParams,
          actionUrl: data.actionUrl,
          requiresAction: data.requiresAction,
          matchId: data.matchId,
        })
        .returning();

      await tx.insert(notificationStatus).values({
        notificationId: notification.id,
        userId: data.userId,
        read: false,
        actionCompleted: false,
      });

      return notification;
    });
  },

  async getForUser(userId: string) {
    // Join notifications with status to get read/action status
    const result = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        matchId: notifications.matchId,
        titleKey: notifications.titleKey,
        messageKey: notifications.messageKey,
        translationParams: notifications.translationParams,
        actionUrl: notifications.actionUrl,
        requiresAction: notifications.requiresAction,
        createdAt: notifications.createdAt,
        isRead: notificationStatus.read,
        actionCompleted: notificationStatus.actionCompleted,
      })
      .from(notifications)
      .innerJoin(
        notificationStatus,
        eq(notifications.id, notificationStatus.notificationId),
      )
      .where(eq(notificationStatus.userId, userId))
      .orderBy(desc(notifications.createdAt));

    return result;
  },

  async markAsRead(notificationId: string, userId: string) {
    return await db
      .update(notificationStatus)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationStatus.notificationId, notificationId),
          eq(notificationStatus.userId, userId),
        ),
      )
      .returning();
  },

  async markActionCompleted(notificationId: string, userId: string) {
    return await db
      .update(notificationStatus)
      .set({
        actionCompleted: true,
        actionCompletedAt: new Date(),
        read: true, // Auto-mark as read when action is completed
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationStatus.notificationId, notificationId),
          eq(notificationStatus.userId, userId),
        ),
      )
      .returning();
  },

  async getById(notificationId: string) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));
    return notification;
  },

  async incrementResentCount(notificationId: string) {
    return await db
      .update(notifications)
      .set({
        resentCount: sql`${notifications.resentCount} + 1`,
      })
      .where(eq(notifications.id, notificationId));
  },

  async getStatus(notificationId: string, userId: string) {
    const [status] = await db
      .select()
      .from(notificationStatus)
      .where(
        and(
          eq(notificationStatus.notificationId, notificationId),
          eq(notificationStatus.userId, userId),
        ),
      );
    return status;
  },

  /**
   * Drops one recipient's copy, and the notification itself once nobody holds it any
   * more. Whether the deletion is allowed is the service's call — see
   * notificationService.delete.
   */
  async delete(notificationId: string, userId: string) {
    await db
      .delete(notificationStatus)
      .where(
        and(
          eq(notificationStatus.notificationId, notificationId),
          eq(notificationStatus.userId, userId),
        ),
      );

    const remainingStatuses = await db
      .select()
      .from(notificationStatus)
      .where(eq(notificationStatus.notificationId, notificationId));

    if (remainingStatuses.length === 0) {
      await db
        .delete(notifications)
        .where(eq(notifications.id, notificationId));
    }
  },

  /**
   * Whether a user still has an unread notification of a given type for a match.
   * Used to avoid stacking one notification per message on a busy thread.
   */
  async hasUnreadOfTypeForMatch(
    userId: string,
    matchId: string,
    type: CreateNotification["type"],
  ): Promise<boolean> {
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .innerJoin(
        notificationStatus,
        eq(notifications.id, notificationStatus.notificationId),
      )
      .where(
        and(
          eq(notifications.matchId, matchId),
          eq(notifications.type, type),
          eq(notificationStatus.userId, userId),
          eq(notificationStatus.read, false),
        ),
      )
      .limit(1);

    return !!existing;
  },

  async deleteActionsByMatchIdForUser(matchId: string, userId: string) {
    const toDelete = await db
      .select({ id: notifications.id, userId: notificationStatus.userId })
      .from(notifications)
      .innerJoin(
        notificationStatus,
        eq(notifications.id, notificationStatus.notificationId),
      )
      .where(
        and(
          eq(notifications.matchId, matchId),
          eq(notifications.requiresAction, true),
          eq(notificationStatus.userId, userId),
        ),
      );

    for (const notif of toDelete) {
      await db.delete(notifications).where(eq(notifications.id, notif.id));
    }

    return toDelete;
  },

  /**
   * Delete the actionable notifications of a single type for a match.
   * Narrower than deleteActionsByMatchId: used when one situation is resolved
   * (a withdrawn dispute) while other pending actions must survive.
   */
  async deleteActionsByMatchIdAndType(
    matchId: string,
    type: CreateNotification["type"],
  ) {
    const toDelete = await db
      .select({ id: notifications.id, userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          eq(notifications.matchId, matchId),
          eq(notifications.type, type),
          eq(notifications.requiresAction, true),
        ),
      );

    for (const notif of toDelete) {
      await db.delete(notifications).where(eq(notifications.id, notif.id));
    }

    return toDelete;
  },

  async deleteActionsByMatchId(matchId: string) {
    // Find all requiresAction notifications for this match
    const toDelete = await db
      .select({ id: notifications.id, userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          eq(notifications.matchId, matchId),
          eq(notifications.requiresAction, true),
        ),
      );

    // Delete notifications (cascade handles notification_status rows)
    for (const notif of toDelete) {
      await db.delete(notifications).where(eq(notifications.id, notif.id));
    }

    return toDelete;
  },
};
