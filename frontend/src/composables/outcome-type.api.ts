import http from '@/config/ApiConfig'
import type {
  OutcomeType,
  CreateOutcomeTypeRequestData,
  UpdateOutcomeTypeRequestData,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/outcome-types'

export const outcomeTypeApi = {
  async list(disciplineId?: string): Promise<OutcomeType[]> {
    const params = disciplineId ? { disciplineId } : undefined
    const response = await http.get<OutcomeType[]>(BASE_URL, { params })
    return response.data
  },

  async getById(id: string): Promise<OutcomeType> {
    const response = await http.get<OutcomeType>(`${BASE_URL}/${id}`)
    return response.data
  },

  async create(payload: CreateOutcomeTypeRequestData): Promise<OutcomeType> {
    const response = await http.post<OutcomeType>(BASE_URL, payload)
    return response.data
  },

  async update(
    id: string,
    payload: UpdateOutcomeTypeRequestData,
  ): Promise<OutcomeType> {
    const response = await http.patch<OutcomeType>(`${BASE_URL}/${id}`, payload)
    return response.data
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await http.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`)
    return response.data
  },
}


