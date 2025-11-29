import http from '@/config/ApiConfig'
import type {
  Discipline,
  CreateDisciplineRequestData,
  UpdateDisciplineRequestData,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/disciplines'


export const disciplineApi = {
  async list(): Promise<Discipline[]> {
    const response = await http.get<Discipline[]>(BASE_URL)
    return response.data
  },

  async getById(id: string): Promise<Discipline> {
    const response = await http.get<Discipline>(`${BASE_URL}/${id}`)
    return response.data
  },

  async create(payload: CreateDisciplineRequestData): Promise<Discipline> {
    const response = await http.post<Discipline>(BASE_URL, payload)
    return response.data
  },

  async update(id: string, payload: UpdateDisciplineRequestData): Promise<Discipline> {
    const response = await http.patch<Discipline>(`${BASE_URL}/${id}`, payload)
    return response.data
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await http.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`)
    return response.data
  },
}


