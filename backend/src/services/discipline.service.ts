import { disciplineRepository } from "../repository/discipline.repository";
import {
  type CreateDisciplineInput,
  type UpdateDisciplineInput,
} from "@skill-arena/shared/types/index";
import {
  ErrorCode,
  NotFoundError,
  BadRequestError,
} from "../types/errors";

export class DisciplineService {
  async createDiscipline(input: CreateDisciplineInput) {
    return await disciplineRepository.create({
      name: input.name,
    });
  }

  async getDisciplineById(id: string) {
    const discipline = await disciplineRepository.getById(id);
    if (!discipline) {
      throw new NotFoundError(ErrorCode.DISCIPLINE_NOT_FOUND);
    }
    return discipline;
  }

  async listDisciplines() {
    return await disciplineRepository.list();
  }

  async updateDiscipline(id: string, input: UpdateDisciplineInput) {
    await this.getDisciplineById(id);
    return await disciplineRepository.update(id, {
      name: input.name,
    });
  }

  async deleteDiscipline(id: string) {
    await this.getDisciplineById(id);
    await disciplineRepository.delete(id);
    return { success: true, message: "Discipline deleted successfully" };
  }
}

export const disciplineService = new DisciplineService();


