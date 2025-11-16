import { outcomeTypeRepository } from "../repository/outcome-type.repository";
import { disciplineRepository } from "../repository/discipline.repository";
import {
  type CreateOutcomeTypeInput,
  type UpdateOutcomeTypeInput,
} from "@skill-arena/shared/types/index";
import {
  ErrorCode,
  NotFoundError,
} from "../types/errors";

export class OutcomeTypeService {
  async createOutcomeType(input: CreateOutcomeTypeInput) {
    await this.validateDisciplineExists(input.disciplineId);
    return await outcomeTypeRepository.create({
      disciplineId: input.disciplineId,
      name: input.name,
    });
  }

  async getOutcomeTypeById(id: string) {
    const outcomeType = await outcomeTypeRepository.getById(id);
    if (!outcomeType) {
      throw new NotFoundError(ErrorCode.OUTCOME_TYPE_NOT_FOUND);
    }
    return outcomeType;
  }

  async listOutcomeTypes(disciplineId?: string) {
    if (disciplineId) {
      await this.validateDisciplineExists(disciplineId);
    }
    return await outcomeTypeRepository.list(disciplineId);
  }

  async updateOutcomeType(id: string, input: UpdateOutcomeTypeInput) {
    await this.getOutcomeTypeById(id);
    if (input.disciplineId) {
      await this.validateDisciplineExists(input.disciplineId);
    }
    return await outcomeTypeRepository.update(id, {
      disciplineId: input.disciplineId,
      name: input.name,
    });
  }

  async deleteOutcomeType(id: string) {
    await this.getOutcomeTypeById(id);
    await outcomeTypeRepository.delete(id);
    return { success: true, message: "Outcome type deleted successfully" };
  }

  private async validateDisciplineExists(disciplineId: string) {
    const discipline = await disciplineRepository.getById(disciplineId);
    if (!discipline) {
      throw new NotFoundError(ErrorCode.DISCIPLINE_NOT_FOUND);
    }
  }
}

export const outcomeTypeService = new OutcomeTypeService();


