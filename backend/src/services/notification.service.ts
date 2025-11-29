import webpush from "web-push";
import i18next from "../config/i18n";
import { notificationRepository } from "../repository/notification.repository";
import { pushDeviceRepository } from "../repository/push-device.repository";
import { webSocketService } from "./websocket.service";
import { CreateNotification, RegisterDevice } from "@skill-arena/shared";

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:noreply@skill-arena.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Decode HTML entities for plain text display (push notifications)
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&#x2F;': '/',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x60;': '`',
  };
  
  return text.replace(/&#x[0-9A-F]+;|&[a-z]+;/gi, (match) => {
    return entities[match] || match;
  });
}

export const notificationService = {
  async send(data: CreateNotification) {
    console.log(`[Notification] Creating notification for user ${data.userId}, type: ${data.type}`);
    const notification = await notificationRepository.create(data);

    const lng = "fr";
    const title = i18next.t(data.titleKey, { lng, ...data.translationParams });
    const message = i18next.t(data.messageKey, { lng, ...data.translationParams });

    // Payload for WebSocket (HTML entities preserved for v-html)
    const payload = {
      ...notification,
      title,
      message,
    };

    console.log(`[Notification] Sending WebSocket notification to user ${data.userId}`);
    const sent = webSocketService.send(data.userId, {
      event: "new_notification",
      data: payload,
    });
    console.log(`[Notification] WebSocket send result: ${sent}`);

    console.log(`[Push] Fetching push devices for user ${data.userId}`);
    const devices = await pushDeviceRepository.getActiveForUser(data.userId);
    console.log(`[Push] Found ${devices.length} push device(s) for user ${data.userId}`);
    
    // Payload for Push notifications (HTML entities decoded for plain text)
    const pushPayload = {
      ...notification,
      title: decodeHtmlEntities(title),
      message: decodeHtmlEntities(message),
    };
    
    for (const device of devices) {
      console.log(`[Push] Processing device ${device.id}, endpoint: ${device.subscriptionEndpoint.substring(0, 50)}...`);
      try {
        let keys = undefined;
        if (device.subscriptionData) {
          try {
            const parsed = JSON.parse(device.subscriptionData);
            // If subscriptionData IS the keys object or contains it
            keys = parsed.keys || parsed;
            console.log(`[Push] Parsed subscription keys for device ${device.id}`);
          } catch (e) {
            console.error(`[Push] Failed to parse subscription data for device ${device.id}`, e);
          }
        } else {
          console.warn(`[Push] No subscription data for device ${device.id}`);
        }

        if (keys) {
          const pushSubscription = {
            endpoint: device.subscriptionEndpoint,
            keys: keys,
          };

          console.log(`[Push] Sending push notification to device ${device.id}`);
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(pushPayload)
          );
          console.log(`[Push] Successfully sent push notification to device ${device.id}`);
        } else {
          console.warn(`[Push] Skipping device ${device.id} - no valid keys`);
        }
      } catch (error) {
        console.error(`[Push] Error sending push notification to device ${device.id}:`, error);
        if (
          error instanceof Error &&
          "statusCode" in error &&
          (error as any).statusCode === 410
        ) {
          console.log(
            `[Push] Removing inactive push device ${device.id} for user ${device.userId}`
          );
          await pushDeviceRepository.remove(device.userId, device.id);
        }
      }
    }

    return notification;
  },

  async getForUser(userId: string, lng: string = "fr") {
    const notifications = await notificationRepository.getForUser(userId);
    return notifications.map((n) => ({
      ...n,
      title: i18next.t(n.titleKey, { lng, ...(n.translationParams as Record<string, any>) }),
      message: i18next.t(n.messageKey, { lng, ...(n.translationParams as Record<string, any>) }),
    }));
  },

  async markAsRead(notificationId: string, userId: string) {
    return await notificationRepository.markAsRead(notificationId, userId);
  },

  async markActionCompleted(notificationId: string, userId: string) {
    return await notificationRepository.markActionCompleted(
      notificationId,
      userId
    );
  },

  async registerPushDevice(userId: string, data: RegisterDevice) {
    console.log('[NotificationService] Registering push device for user:', userId);
    const result = await pushDeviceRepository.register(userId, data);
    console.log('[NotificationService] Push device registered, result:', result);
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
};
