import { z } from "zod";

export const NotificationTypeEnum = z.enum([
  "MATCH_INVITE",
  "MATCH_REMINDER",
  "MATCH_VALIDATION",
  "TOURNAMENT_UPDATE",
  "SYSTEM_ALERT",
  "match_created",
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
});

export const RegisterDeviceSchema = z.object({
  deviceType: DeviceTypeEnum,
  subscriptionEndpoint: z.string(),
  subscriptionData: z.record(z.string(), z.any()).optional(),
});

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().nullable(),
  requiresAction: z.boolean(),
  isRead: z.boolean(),
  createdAt: z.string(), // ISO date
});

export type NotificationType = z.infer<typeof NotificationTypeEnum>;
export type DeviceType = z.infer<typeof DeviceTypeEnum>;
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
export type RegisterDevice = z.infer<typeof RegisterDeviceSchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
