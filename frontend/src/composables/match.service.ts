import { matchApi } from './match.api'
import type {
  MatchModel,
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ListMatchesQuery,
  ValidateMatchRequestData,
} from '@skill-arena/shared'

export function useMatchService() {
  const createMatch = async (data: CreateMatchRequestData): Promise<MatchModel> => {
    return await matchApi.create(data)
  }

  const getMatch = async (id: string): Promise<MatchModel> => {
    return await matchApi.getById(id)
  }

  const listMatches = async (filters?: ListMatchesQuery): Promise<MatchModel[]> => {
    return await matchApi.list(filters)
  }

  const updateMatch = async (id: string, data: UpdateMatchRequestData): Promise<MatchModel> => {
    return await matchApi.update(id, data)
  }

  const deleteMatch = async (id: string): Promise<void> => {
    await matchApi.delete(id)
  }

  const reportMatchResult = async (
    id: string,
    data: ReportMatchResultRequestData,
  ): Promise<MatchModel> => {
    return await matchApi.reportResult(id, data)
  }

  const confirmMatchResult = async (
    id: string,
    data: ConfirmMatchResultRequestData,
  ): Promise<MatchModel> => {
    return await matchApi.confirmResult(id, data)
  }

  const validateMatch = async (data: ValidateMatchRequestData) => {
    return await matchApi.validate(data)
  }

  return {
    createMatch,
    getMatch,
    listMatches,
    updateMatch,
    deleteMatch,
    reportMatchResult,
    confirmMatchResult,
    validateMatch,
  }
}
