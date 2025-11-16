import { eq, and } from "drizzle-orm";
import { db } from "../config/database";
import { outcomeTypes } from "../db/schema";

export interface CreateOutcomeTypeData {
  disciplineId: string;
  name: string;
}

export interface UpdateOutcomeTypeData {
  disciplineId?: string;
  name?: string;
}

export class OutcomeTypeRepository {
  async create(data: CreateOutcomeTypeData) {
    const [outcomeType] = await db
      .insert(outcomeTypes)
      .values(data)
      .returning();
    return outcomeType;
  }

  async getById(id: string) {
    return await db.query.outcomeTypes.findFirst({
      where: eq(outcomeTypes.id, id),
      with: {
        discipline: true,
      },
    });
  }

  async list(disciplineId?: string) {
    const conditions = [];
    
    if (disciplineId) {
      conditions.push(eq(outcomeTypes.disciplineId, disciplineId));
    }

    return await db.query.outcomeTypes.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        discipline: true,
      },
      orderBy: (outcomeTypes, { asc }) => [asc(outcomeTypes.name)],
    });
  }

  async update(id: string, data: UpdateOutcomeTypeData) {
    const [updated] = await db
      .update(outcomeTypes)
      .set(data)
      .where(eq(outcomeTypes.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(outcomeTypes).where(eq(outcomeTypes.id, id));
  }
}

export const outcomeTypeRepository = new OutcomeTypeRepository();

