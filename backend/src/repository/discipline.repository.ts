import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { disciplines } from "../db/schema";

export interface CreateDisciplineData {
  name: string;
}

export interface UpdateDisciplineData {
  name?: string;
}

export class DisciplineRepository {
  async create(data: CreateDisciplineData) {
    const [discipline] = await db
      .insert(disciplines)
      .values(data)
      .returning();
    return discipline;
  }

  async getById(id: string) {
    return await db.query.disciplines.findFirst({
      where: eq(disciplines.id, id),
    });
  }

  async list() {
    return await db.query.disciplines.findMany({
      orderBy: (disciplines, { asc }) => [asc(disciplines.name)],
    });
  }

  async update(id: string, data: UpdateDisciplineData) {
    const [updated] = await db
      .update(disciplines)
      .set(data)
      .where(eq(disciplines.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    await db.delete(disciplines).where(eq(disciplines.id, id));
  }
}

export const disciplineRepository = new DisciplineRepository();


