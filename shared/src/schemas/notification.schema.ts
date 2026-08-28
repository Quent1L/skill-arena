import { z } from "zod";

export const NotificationTypeEnum = z.enum([
  "MATCH_CREATED",
  "MATCH_VALIDATION",
  // Deprecated: the score counter-proposal flow was removed.
  "MATCH_SCORE_PROPOSAL",
  "MATCH_POST_DISPUTE",
  "MATCH_DISPUTE_ESCALATED",
  "MATCH_MESSAGE",
  "BADGE_AWARDED",
  "BADGE_REVOKED",
]);

export const DeviceTypeEnum = z.enum(["WEB", "ANDROID", "IOS"]);

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: NotificationTypeEnum,
  titleKey: z.string(),
  messageKey: z.string(),
  translationParams: z.record(z.string(), z.any()).optional(),
  actionUrl: z.string().optional(),
  requiresAction: z.boolean().default(false),
  matchId: z.string().uuid().optional(),
});

export const RegisterDeviceSchema = z.object({
  deviceType: DeviceTypeEnum,
  subscriptionEndpoint: z.string(),
  subscriptionData: z.record(z.string(), z.any()).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const NotificationResponseSchema = z
  .object({
    id: z.string().uuid(),
    // Pre-rendered server-side, kept as a fallback when the client does not know the key
    title: z.string(),
    message: z.string(),
    // Raw keys + params so the client can render with its own locale and timezone
    titleKey: z.string(),
    messageKey: z.string(),
    translationParams: z.record(z.string(), z.any()).nullable().optional(),
    actionUrl: z.string().nullable(),
    requiresAction: z.boolean(),
    /**
     * The action this notification asked for is no longer pending — the contestation was
     * taken back, the match left the conflict, the match is gone. It stops blocking and
     * can be dismissed like any other. Always false when `requiresAction` is false.
     */
    actionResolved: z.boolean(),
    isRead: z.boolean(),
    actionCompleted: z.boolean().optional(),
    createdAt: z.string(), // ISO date
  })
  .meta({ id: "Notification" });

export const NotificationListSchema = z.array(NotificationResponseSchema);

/** A push subscription registered for the current user. */
export const PushDeviceSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    deviceType: DeviceTypeEnum,
    subscriptionEndpoint: z.string(),
    subscriptionData: z.string().nullable(),
    active: z.boolean(),
    locale: z.string().nullable(),
    timezone: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: "PushDevice" });

export type PushDevice = z.infer<typeof PushDeviceSchema>;

export type NotificationType = z.infer<typeof NotificationTypeEnum>;
export type DeviceType = z.infer<typeof DeviceTypeEnum>;
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
export type RegisterDevice = z.infer<typeof RegisterDeviceSchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
