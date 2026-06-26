import webpush from "web-push";
import { logger } from "../utils/logger";
import i18next from "../config/i18n";
import { notificationRepository } from "../repository/notification.repository";
import { pushDeviceRepository } from "../repository/push-device.repository";
import { webSocketService } from "./websocket.service";
import { CreateNotification, RegisterDevice } from "@skol-arena/shared";

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:noreply@skol-arena.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Decode HTML entities for plain text display (push notifications)
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&#x2F;": "/",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x60;": "`",
  };

  return text.replace(/&#x[0-9A-F]+;|&[a-z]+;/gi, (match) => {
    return entities[match] || match;
  });
}

type PushDevice = Awaited<ReturnType<typeof pushDeviceRepository.getActiveForUser>>[number];

function buildNotificationContent(data: CreateNotification): { title: string; message: string } {
  const lng = "fr";
  return {
    title: String(i18next.t(data.titleKey, { lng, ...data.translationParams })),
    message: String(i18next.t(data.messageKey, { lng, ...data.translationParams })),
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
    // WebSocket payload keeps HTML entities (rendered with v-html)
    const sent = webSocketService.send(data.userId, {
      event: "new_notification",
      data: { ...notification, title, message },
    });
    logger.debug(`[Notification] WebSocket send result: ${sent}`);

    logger.debug(`[Push] Fetching push devices for user ${data.userId}`);
    const devices = await pushDeviceRepository.getActiveForUser(data.userId);
    logger.debug(
      `[Push] Found ${devices.length} push device(s) for user ${data.userId}`,
    );

    // Push payload decodes HTML entities for plain text
    const pushPayload = {
      ...notification,
      title: decodeHtmlEntities(title),
      message: decodeHtmlEntities(message),
    };

    for (const device of devices) {
      await sendPushToDevice(device, pushPayload);
    }

    return notification;
  },

  async getForUser(userId: string, lng: string = "fr") {
    const notifications = await notificationRepository.getForUser(userId);
    return notifications.map((n) => ({
      ...n,
      title: i18next.t(n.titleKey, {
        lng,
        ...(n.translationParams as Record<string, unknown>),
      }),
      message: i18next.t(n.messageKey, {
        lng,
        ...(n.translationParams as Record<string, unknown>),
      }),
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
      actionUrl: original.actionUrl || undefined,
      requiresAction: original.requiresAction,
    };

    return await this.send(newData);
  },

  async delete(notificationId: string, userId: string) {
    return await notificationRepository.delete(notificationId, userId);
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
