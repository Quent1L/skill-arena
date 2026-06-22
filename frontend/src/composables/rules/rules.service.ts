import { ref } from 'vue'
import { rulesApi, type BadgeReconciliationStatus, type CatalogFact, type RuleListFilters } from './rules.api'
import type {
  ClientRule,
  CreateRuleData,
  RuleAction,
  RuleConditions,
  TestRuleResult,
  UpdateRuleData,
} from '@skill-arena/shared/types/index'

export function useRulesService() {
  const rules = ref<ClientRule[]>([])
  const currentRule = ref<ClientRule | null>(null)
  const catalog = ref<CatalogFact[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadRules(filters: RuleListFilters = {}) {
    loading.value = true
    error.value = null
    try {
      rules.value = await rulesApi.list(filters)
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
      currentRule.value = await rulesApi.getById(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement de la règle'
    } finally {
      loading.value = false
    }
  }

  async function loadCatalog(triggerEvent: string) {
    try {
      const result = await rulesApi.getCatalog(triggerEvent)
      catalog.value = result.facts
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du catalogue'
    }
  }

  async function createRule(data: CreateRuleData): Promise<ClientRule | null> {
    loading.value = true
    error.value = null
    try {
      const rule = await rulesApi.create(data)
      rules.value.unshift(rule)
      return rule
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création de la règle'
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateRule(id: string, data: UpdateRuleData): Promise<ClientRule | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await rulesApi.update(id, data)
      const idx = rules.value.findIndex((r) => r.id === id)
      if (idx !== -1) rules.value[idx] = updated
      currentRule.value = updated
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la règle'
      return null
    } finally {
      loading.value = false
    }
  }

  async function deleteRule(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await rulesApi.delete(id)
      rules.value = rules.value.filter((r) => r.id !== id)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la suppression de la règle'
      return false
    } finally {
      loading.value = false
    }
  }

  async function getBadgeCount(id: string): Promise<number> {
    try {
      return await rulesApi.getBadgeCount(id)
    } catch {
      return 0
    }
  }

  const reconciliationStatus = ref<BadgeReconciliationStatus | null>(null)

  async function loadReconciliationStatus() {
    try {
      reconciliationStatus.value = await rulesApi.getReconciliationStatus()
    } catch {
      reconciliationStatus.value = null
    }
  }

  async function triggerReconciliation(): Promise<boolean> {
    try {
      await rulesApi.triggerReconciliation()
      await loadReconciliationStatus()
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du déclenchement du recalcul'
      return false
    }
  }

  async function testRule(
    triggerEvent: string,
    conditions: RuleConditions,
    action: RuleAction,
    context: Record<string, unknown>,
  ): Promise<TestRuleResult | null> {
    try {
      return await rulesApi.test({ triggerEvent, conditions, action, context })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du test de la règle'
      return null
    }
  }

  return {
    rules,
    currentRule,
    catalog,
    loading,
    error,
    loadRules,
    loadRuleById,
    loadCatalog,
    createRule,
    updateRule,
    deleteRule,
    getBadgeCount,
    reconciliationStatus,
    loadReconciliationStatus,
    triggerReconciliation,
    testRule,
  }
}
