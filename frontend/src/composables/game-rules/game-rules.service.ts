import { ref } from 'vue'
import { gameRulesApi } from './game-rules.api'
import type { ClientGameRule, CreateGameRuleData, UpdateGameRuleData } from '@skill-arena/shared/types/index'

export function useGameRulesService() {
  const rules = ref<ClientGameRule[]>([])
  const currentRule = ref<ClientGameRule | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadRules() {
    loading.value = true
    error.value = null
    try {
      rules.value = await gameRulesApi.list()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement des règles'
    } finally {
      loading.value = false
    }
  }

  async function loadRuleById(id: string) {
    loading.value = true
    error.value = null
    try {
      currentRule.value = await gameRulesApi.getById(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du règlement'
    } finally {
      loading.value = false
    }
  }

  async function createRule(data: CreateGameRuleData): Promise<ClientGameRule | null> {
    loading.value = true
    error.value = null
    try {
      const rule = await gameRulesApi.create(data)
      rules.value.unshift(rule)
      return rule
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création du règlement'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateRule(id: string, data: UpdateGameRuleData): Promise<ClientGameRule | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await gameRulesApi.update(id, data)
      const idx = rules.value.findIndex((r) => r.id === id)
      if (idx !== -1) rules.value[idx] = updated
      currentRule.value = updated
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du règlement'
      return null
    } finally {
      loading.value = false
    }
  }

  async function deleteRule(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await gameRulesApi.delete(id)
      rules.value = rules.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la suppression du règlement'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    rules,
    currentRule,
    loading,
    error,
    loadRules,
    loadRuleById,
    createRule,
    updateRule,
    deleteRule,
  }
}
