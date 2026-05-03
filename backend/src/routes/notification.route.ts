import { zValidator } from '@hono/zod-validator';
import { notificationService } from '../services/notification.service';
import { RegisterDeviceSchema } from '@skill-arena/shared';
import { requireAuth } from '../middleware/auth';
import { createAppHono } from '../types/hono';
import { logger } from '../utils/logger';

const app = createAppHono();

app.get('/me/notifications', requireAuth, async (c) => {
  const appUserId = c.get('appUserId');
  const lng = c.get('lang') || 'fr';

  const notifications = await notificationService.getForUser(appUserId, lng);
  return c.json(notifications);
});

app.post('/me/notifications/:id/read', requireAuth, async (c) => {
  const appUserId = c.get('appUserId');
  const id = c.req.param('id')!;
  
  await notificationService.markAsRead(id, appUserId);
  return c.json({ success: true });
});

app.post('/me/notifications/:id/action-completed', requireAuth, async (c) => {
  const appUserId = c.get('appUserId');
  const id = c.req.param('id')!;
  
  await notificationService.markActionCompleted(id, appUserId);
  return c.json({ success: true });
});

app.post('/me/pushDevices', requireAuth, zValidator('json', RegisterDeviceSchema), async (c) => {
  const appUserId = c.get('appUserId');
  const data = c.req.valid('json');
  
  logger.debug({ userId: appUserId }, '[PushDevice] Registration request for user:');
  logger.debug({ deviceType: data.deviceType }, '[PushDevice] Device type:');
  logger.debug({ endpoint: data.subscriptionEndpoint }, '[PushDevice] Endpoint:');
  logger.debug({ keys: Object.keys(data.subscriptionData || {}) }, '[PushDevice] Subscription keys:');
  
  await notificationService.registerPushDevice(appUserId, data);
  logger.debug('[PushDevice] Registration completed successfully');
  return c.json({ success: true });
});

app.get('/me/pushDevices', requireAuth, async (c) => {
  const appUserId = c.get('appUserId');
  
  const devices = await notificationService.getPushDevices(appUserId);
  return c.json(devices);
});

app.delete('/me/pushDevices/:id', requireAuth, async (c) => {
  const appUserId = c.get('appUserId');
  const id = c.req.param('id')!;
  
  await notificationService.removePushDevice(appUserId, id);
  return c.json({ success: true });
});


app.post('/notifications/:id/resend', requireAuth, async (c) => {
    const id = c.req.param('id')!;
    const body = await c.req.json().catch(() => ({}));
    
    try {
        const notification = await notificationService.resend(id, body.messageKey);
        return c.json(notification);
    } catch (error) {
        logger.error(error);
        return c.json({ error: 'Failed to resend' }, 400);
    }
});

app.delete('/me/notifications/:id', requireAuth, async (c) => {
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
});

export default app;
