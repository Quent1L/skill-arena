import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { outcomeReasons } from "../db/schema";

export interface CreateOutcomeReasonData {
  outcomeTypeId: string;
  name: string;
}

export interface UpdateOutcomeReasonData {
  outcomeTypeId?: string;
  name?: string;
}

export class OutcomeReasonRepository {
  async create(data: CreateOutcomeReasonData) {
    const [outcomeReason] = await db
      .insert(outcomeReasons)
      .values(data)
      .returning();
    return outcomeReason;
  }

  async getById(id: string) {
    return await db.query.outcomeReasons.findFirst({
      where: eq(outcomeReasons.id, id),
      with: {
        outcomeType: {
          with: {
            discipline: true,
          },
        },
      },
    });
  }

  async list(outcomeTypeId?: string) {
    const conditions = [];
    
    if (outcomeTypeId) {
      conditions.push(eq(outcomeReasons.outcomeTypeId, outcomeTypeId));
    }

    return await db.query.outcomeReasons.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        outcomeType: {
          with: {
            discipline: true,
          },
        },
      },
      orderBy: (outcomeReasons, { asc }) => [asc(outcomeReasons.name)],
    });
  }

  async update(id: string, data: UpdateOutcomeReasonData) {
    const [updated] = await db
      .update(outcomeReasons)
      .set(data)
      .where(eq(outcomeReasons.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(outcomeReasons).where(eq(outcomeReasons.id, id));
  }
}

export const outcomeReasonRepository = new OutcomeReasonRepository();

