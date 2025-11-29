import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/database";
import { notifications, notificationStatus } from "../db/schema";
import { CreateNotification } from "@skill-arena/shared";

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
        eq(notifications.id, notificationStatus.notificationId)
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
          eq(notificationStatus.userId, userId)
        )
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
          eq(notificationStatus.userId, userId)
        )
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
          eq(notificationStatus.userId, userId)
        )
      );
    return status;
  },

  async delete(notificationId: string, userId: string) {
    const notification = await this.getById(notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }
    if (notification.requiresAction) {
      throw new Error("Cannot delete blocking notification");
    }

    await db
      .delete(notificationStatus)
      .where(
        and(
          eq(notificationStatus.notificationId, notificationId),
          eq(notificationStatus.userId, userId)
        )
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
};
