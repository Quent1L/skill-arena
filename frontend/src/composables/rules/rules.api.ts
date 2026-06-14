import http from '@/config/ApiConfig'
import type {
  ClientPlayerBadge,
  ClientRule,
  CreateRuleData,
  FactDefinition,
  RuleAction,
  RuleConditions,
  TestRuleResult,
  UpdateRuleData,
} from '@skill-arena/shared/types/index'

const BASE_URL = '/api/admin/rules'

export interface RuleListFilters {
  type?: 'message' | 'badge'
  triggerEvent?: string
  scope?: 'global' | 'discipline'
  isActive?: boolean
}

export interface CatalogFact extends FactDefinition {
  operators: string[]
}

/**
 * Raw API calls to backend - no business logic here
 */
export const rulesApi = {
  async list(filters: RuleListFilters = {}): Promise<ClientRule[]> {
    const response = await http.get<ClientRule[]>(BASE_URL, { params: filters })
    return response.data
  },

  async getById(id: string): Promise<ClientRule> {
    const response = await http.get<ClientRule>(`${BASE_URL}/${id}`)
    return response.data
  },

  async create(data: CreateRuleData): Promise<ClientRule> {
    const response = await http.post<ClientRule>(BASE_URL, data)
    return response.data
  },

  async update(id: string, data: UpdateRuleData): Promise<ClientRule> {
    const response = await http.patch<ClientRule>(`${BASE_URL}/${id}`, data)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await http.delete(`${BASE_URL}/${id}`)
  },

  async getCatalog(triggerEvent: string): Promise<{ facts: CatalogFact[] }> {
    const response = await http.get<{ facts: CatalogFact[] }>(`${BASE_URL}/catalog`, {
      params: { triggerEvent },
    })
    return response.data
  },

  async test(payload: {
    triggerEvent: string
    conditions: RuleConditions
    action: RuleAction
    context: Record<string, unknown>
  }): Promise<TestRuleResult> {
    const response = await http.post<TestRuleResult>(`${BASE_URL}/test`, payload)
    return response.data
  },

  async getPlayerBadges(playerId: string): Promise<ClientPlayerBadge[]> {
    const response = await http.get<{ badges: ClientPlayerBadge[] }>(`/api/users/${playerId}/badges`)
    return response.data.badges
  },
}
