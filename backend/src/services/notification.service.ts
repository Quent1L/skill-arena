import webpush from "web-push";
import { logger } from "../utils/logger";
import i18next from "../config/i18n";
import { notificationRepository } from "../repository/notification.repository";
import { pushDeviceRepository } from "../repository/push-device.repository";
import { webSocketService } from "./websocket.service";
import { localizeNotificationParams } from "../utils/notification-format";
import { notificationActionService } from "./notification-action.service";
import { BadRequestError, NotFoundError, ErrorCode } from "../types/errors";
import { CreateNotification, RegisterDevice } from "@skol-arena/shared";

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:noreply@skol-arena.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

type PushDevice = Awaited<ReturnType<typeof pushDeviceRepository.getActiveForUser>>[number];

function buildNotificationContent(
  data: Pick<CreateNotification, "titleKey" | "messageKey" | "translationParams">,
  lng: string = "fr",
  timeZone?: string,
): { title: string; message: string } {
  const params = localizeNotificationParams(data.translationParams, lng, timeZone);
  return {
    title: String(i18next.t(data.titleKey, { lng, ...params })),
    message: String(i18next.t(data.messageKey, { lng, ...params })),
  };
}

function parseSubscriptionKeys(
  device: PushDevice,
): { p256dh: string; auth: string } | undefined {
  if (!device.subscriptionData) {
    logger.warn(`[Push] No subscription data for device ${device.id}`);
    return undefined;
  }
  try {
    const parsed = JSON.parse(device.subscriptionData);
    logger.debug(`[Push] Parsed subscription keys for device ${device.id}`);
    return parsed.keys || parsed;
  } catch (e) {
    logger.error({ err: e }, `[Push] Failed to parse subscription data for device ${device.id}`);
    return undefined;
  }
}

function isExpiredSubscriptionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === 410
  );
}

async function sendPushToDevice(device: PushDevice, pushPayload: unknown): Promise<void> {
  logger.debug(
    `[Push] Processing device ${device.id}, endpoint: ${device.subscriptionEndpoint.substring(0, 50)}...`,
  );
  try {
    const keys = parseSubscriptionKeys(device);
    if (!keys) {
      logger.warn(`[Push] Skipping device ${device.id} - no valid keys`);
      return;
    }

    logger.debug(`[Push] Sending push notification to device ${device.id}`);
    await webpush.sendNotification(
      { endpoint: device.subscriptionEndpoint, keys },
      JSON.stringify(pushPayload),
    );
    logger.debug(`[Push] Successfully sent push notification to device ${device.id}`);
  } catch (error) {
    logger.error({ err: error }, `[Push] Error sending push notification to device ${device.id}:`);
    if (isExpiredSubscriptionError(error)) {
      logger.debug(`[Push] Removing inactive push device ${device.id} for user ${device.userId}`);
      await pushDeviceRepository.remove(device.userId, device.id);
    }
  }
}

export const notificationService = {
  async send(data: CreateNotification) {
    logger.debug(
      `[Notification] Creating notification for user ${data.userId}, type: ${data.type}`,
    );
    const notification = await notificationRepository.create(data);

    const { title, message } = buildNotificationContent(data);

    logger.debug(
      `[Notification] Sending WebSocket notification to user ${data.userId}`,
    );
    // titleKey/messageKey/translationParams travel along: a connected client
    // re-renders them with its own locale and timezone, title/message are the fallback.
    const sent = webSocketService.send(data.userId, {
      // A notification that has just been raised still asks for what it was raised for.
      event: "new_notification",
      data: { ...notification, title, message, actionResolved: false },
    });
    logger.debug(`[Notification] WebSocket send result: ${sent}`);

    logger.debug(`[Push] Fetching push devices for user ${data.userId}`);
    const devices = await pushDeviceRepository.getActiveForUser(data.userId);
    logger.debug(
      `[Push] Found ${devices.length} push device(s) for user ${data.userId}`,
    );

    // The device is offline, so this is the one channel the server must render itself:
    // use the locale and timezone captured when that device registered.
    for (const device of devices) {
      const rendered = buildNotificationContent(
        data,
        device.locale ?? "fr",
        device.timezone ?? undefined,
      );
      await sendPushToDevice(device, { ...notification, ...rendered });
    }

    return notification;
  },

  async getForUser(userId: string, lng: string = "fr") {
    const notifications = await notificationRepository.getForUser(userId);
    // One batch lookup for the whole list: an actionable notification only keeps
    // blocking while the situation it points at is still open.
    const pending = await notificationActionService.resolvePendingActions(notifications);

    return notifications.map(({ matchId: _matchId, type: _type, ...n }) => ({
      ...n,
      actionResolved: n.requiresAction && !pending.has(n.id),
      ...buildNotificationContent(
        {
          titleKey: n.titleKey,
          messageKey: n.messageKey,
          translationParams: n.translationParams as Record<string, unknown>,
        },
        lng,
      ),
    }));
  },

  async markAsRead(notificationId: string, userId: string) {
    return await notificationRepository.markAsRead(notificationId, userId);
  },

  async markActionCompleted(notificationId: string, userId: string) {
    return await notificationRepository.markActionCompleted(
      notificationId,
      userId,
    );
  },

  async registerPushDevice(userId: string, data: RegisterDevice) {
    logger.debug(
      { userId },
      "[NotificationService] Registering push device for user:",
    );
    const result = await pushDeviceRepository.register(userId, data);
    logger.debug(
      { result },
      "[NotificationService] Push device registered, result:",
    );
    return result;
  },

  async getPushDevices(userId: string) {
    return await pushDeviceRepository.getActiveForUser(userId);
  },

  async removePushDevice(userId: string, deviceId: string) {
    return await pushDeviceRepository.remove(userId, deviceId);
  },

  async resend(originalId: string, newMessageKey?: string) {
    const original = await notificationRepository.getById(originalId);
    if (!original) throw new Error("Notification not found");

    await notificationRepository.incrementResentCount(originalId);

    const newData: CreateNotification = {
      userId: original.userId,
      type: original.type,
      titleKey: original.titleKey,
      messageKey: newMessageKey || original.messageKey,
      // Without these the resent notification renders with empty placeholders
      translationParams:
        (original.translationParams as Record<string, unknown> | null) ?? undefined,
      actionUrl: original.actionUrl || undefined,
      requiresAction: original.requiresAction,
      matchId: original.matchId ?? undefined,
    };

    return await this.send(newData);
  },

  /**
   * A notification that asks for something cannot be dismissed while that something is
   * still owed — but the flag it carries was written once, at creation. What decides is
   * the live state: the contestation that has been taken back, the match that left the
   * conflict, the match that no longer exists. Marking the action completed by hand is
   * the other way out.
   */
  async delete(notificationId: string, userId: string) {
    const notification = await notificationRepository.getById(notificationId);
    if (!notification) {
      throw new NotFoundError(ErrorCode.NOT_FOUND);
    }

    if (notification.requiresAction) {
      const status = await notificationRepository.getStatus(notificationId, userId);
      if (!status?.actionCompleted) {
        const pending = await notificationActionService.resolvePendingActions([
          notification,
        ]);
        if (pending.has(notification.id)) {
          throw new BadRequestError(ErrorCode.NOTIFICATION_ACTION_PENDING);
        }
      }
    }

    return await notificationRepository.delete(notificationId, userId);
  },

  async hasUnreadOfTypeForMatch(
    userId: string,
    matchId: string,
    type: CreateNotification["type"],
  ) {
    return await notificationRepository.hasUnreadOfTypeForMatch(
      userId,
      matchId,
      type,
    );
  },

  async deleteActionsByMatchIdForUser(matchId: string, userId: string) {
    const deleted =
      await notificationRepository.deleteActionsByMatchIdForUser(
        matchId,
        userId,
      );
    for (const notif of deleted) {
      webSocketService.send(notif.userId, {
        event: "notification_deleted",
        data: { id: notif.id },
      });
    }
    return deleted;
  },

  async deleteActionsByMatchIdAndType(
    matchId: string,
    type: CreateNotification["type"],
  ) {
    const deleted = await notificationRepository.deleteActionsByMatchIdAndType(
      matchId,
      type,
    );
    for (const notif of deleted) {
      webSocketService.send(notif.userId, {
        event: "notification_deleted",
        data: { id: notif.id },
      });
    }
    return deleted;
  },

  async deleteActionsByMatchId(matchId: string) {
    const deleted =
      await notificationRepository.deleteActionsByMatchId(matchId);
    // Notify each affected user via WebSocket so their UI removes the notification in real-time
    for (const notif of deleted) {
      webSocketService.send(notif.userId, {
        event: "notification_deleted",
        data: { id: notif.id },
      });
    }
    return deleted;
  },
};
