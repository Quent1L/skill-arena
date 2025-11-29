import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { userPushDevices } from "../db/schema";
import { RegisterDevice } from "@skill-arena/shared";

export const pushDeviceRepository = {
  async register(userId: string, data: RegisterDevice) {
    console.log('[PushDeviceRepo] Registering device for user:', userId);
    console.log('[PushDeviceRepo] Endpoint:', data.subscriptionEndpoint);
    
    // Check if device already exists with this endpoint
    const [existing] = await db
      .select()
      .from(userPushDevices)
      .where(
        eq(userPushDevices.subscriptionEndpoint, data.subscriptionEndpoint)
      );

    if (existing) {
      console.log('[PushDeviceRepo] Device already exists, updating:', existing.id);
      const result = await db
        .update(userPushDevices)
        .set({
          userId,
          active: true,
          updatedAt: new Date(),
          subscriptionData: JSON.stringify(data.subscriptionData),
        })
        .where(eq(userPushDevices.id, existing.id))
        .returning();
      console.log('[PushDeviceRepo] Device updated successfully');
      return result;
    }

    console.log('[PushDeviceRepo] Creating new device entry');
    const result = await db
      .insert(userPushDevices)
      .values({
        userId,
        deviceType: data.deviceType,
        subscriptionEndpoint: data.subscriptionEndpoint,
        subscriptionData: JSON.stringify(data.subscriptionData),
        active: true,
      })
      .returning();
    console.log('[PushDeviceRepo] Device created successfully:', result[0]?.id);
    return result;
  },

  async remove(userId: string, deviceId: string) {
    return await db
      .delete(userPushDevices)
      .where(
        and(
          eq(userPushDevices.id, deviceId),
          eq(userPushDevices.userId, userId)
        )
      )
      .returning();
  },

  async getActiveForUser(userId: string) {
    return await db
      .select()
      .from(userPushDevices)
      .where(
        and(
          eq(userPushDevices.userId, userId),
          eq(userPushDevices.active, true)
        )
      );
  },
};
