import { z } from 'zod';
import { validate } from '../api/validator';
import { describe } from '../api/describe';
import { notificationService } from '../services/notification.service';
import {
  RegisterDeviceSchema,
  NotificationResponseSchema,
  NotificationListSchema,
  PushDeviceSchema,
  mutationResultSchema,
} from '@skol-arena/shared';
import { requireAuth } from '../middleware/auth';
import { createAppHono } from '../types/hono';
import { logger } from '../utils/logger';

const app = createAppHono();

const TAGS = ['Notifications'];

app.get(
  '/me/notifications',
  requireAuth,
  describe({
    tags: TAGS,
    summary: "List the current user's notifications",
    description:
      'Titles and messages are pre-rendered using Accept-Language; the raw keys and ' +
      'params are returned alongside so a client can render them itself.',
    auth: true,
    success: { description: 'The notifications', schema: NotificationListSchema },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');
    const lng = c.get('lang') || 'fr';

    const notifications = await notificationService.getForUser(appUserId, lng);
    return c.json(notifications);
  }
);

app.post(
  '/me/notifications/:id/read',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Mark a notification as read',
    auth: true,
    notFound: true,
    success: { description: 'The notification was marked read', schema: mutationResultSchema },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');
    const id = c.req.param('id')!;

    await notificationService.markAsRead(id, appUserId);
    return c.json({ success: true });
  }
);

app.post(
  '/me/notifications/:id/action-completed',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Mark a notification’s action as completed',
    description: 'Applies to notifications whose requiresAction is true.',
    auth: true,
    notFound: true,
    success: { description: 'The action was marked completed', schema: mutationResultSchema },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');
    const id = c.req.param('id')!;

    await notificationService.markActionCompleted(id, appUserId);
    return c.json({ success: true });
  }
);

app.post(
  '/me/pushDevices',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Register a push subscription',
    description:
      'Locale and timezone are captured here because push payloads are rendered ' +
      'server-side while the device is offline.',
    auth: true,
    success: { description: 'The device was registered', schema: mutationResultSchema },
  }),
  validate('json', RegisterDeviceSchema),
  async (c) => {
    const appUserId = c.get('appUserId');
    const data = c.req.valid('json');

    logger.debug({ userId: appUserId }, '[PushDevice] Registration request for user:');
    logger.debug({ deviceType: data.deviceType }, '[PushDevice] Device type:');
    logger.debug({ endpoint: data.subscriptionEndpoint }, '[PushDevice] Endpoint:');
    logger.debug({ keys: Object.keys(data.subscriptionData || {}) }, '[PushDevice] Subscription keys:');

    await notificationService.registerPushDevice(appUserId, data);
    logger.debug('[PushDevice] Registration completed successfully');
    return c.json({ success: true });
  }
);

app.get(
  '/me/pushDevices',
  requireAuth,
  describe({
    tags: TAGS,
    summary: "List the current user's push devices",
    auth: true,
    success: { description: 'Active push subscriptions', schema: z.array(PushDeviceSchema) },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');

    const devices = await notificationService.getPushDevices(appUserId);
    return c.json(devices);
  }
);

app.delete(
  '/me/pushDevices/:id',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Remove a push device',
    auth: true,
    notFound: true,
    success: { description: 'Removal outcome', schema: mutationResultSchema },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');
    const id = c.req.param('id')!;

    await notificationService.removePushDevice(appUserId, id);
    return c.json({ success: true });
  }
);

app.post(
  '/notifications/:id/resend',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Resend a notification',
    description: 'Optionally under a different message key, supplied as `messageKey`.',
    auth: true,
    notFound: true,
    success: { description: 'The notification that was sent again', schema: NotificationResponseSchema },
  }),
  async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json().catch(() => ({}));

    try {
      const notification = await notificationService.resend(id, body.messageKey);
      return c.json(notification);
    } catch (error) {
      logger.error(error);
      return c.json({ error: 'Failed to resend' }, 400);
    }
  }
);

app.delete(
  '/me/notifications/:id',
  requireAuth,
  describe({
    tags: TAGS,
    summary: 'Delete a notification',
    auth: true,
    notFound: true,
    success: { description: 'Deletion outcome', schema: mutationResultSchema },
  }),
  async (c) => {
    const appUserId = c.get('appUserId');
    const id = c.req.param('id')!;

    try {
      await notificationService.delete(id, appUserId);
      return c.json({ success: true });
    } catch (error) {
      logger.error(error);
      const message = error instanceof Error ? error.message : 'Failed to delete notification';
      return c.json({ error: message }, 400);
    }
  }
);

export default app;
