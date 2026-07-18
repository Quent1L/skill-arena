import { ref, computed } from 'vue'
import type { OrganizationWithMemberCount } from '@skol-arena/shared'
import { useDisciplineService } from '@/composables/discipline/discipline.service'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import { useOrganizationService } from '@/composables/organization/organization.service'

/**
 * Loads the reference lists in parallel (disciplines, rules, organizations)
 * that tournament/ranked season forms need for their Selects.
 * Avoids duplicating Promise.all in every view.
 */
export function useFormReferences() {
  const { disciplines, listDisciplines } = useDisciplineService()
  const { rules: gameRulesList, loadRules } = useGameRulesService()
  const { listOrganizations } = useOrganizationService()

  const organizations = ref<OrganizationWithMemberCount[]>([])

  const disciplineOptions = computed(() =>
    disciplines.value.map((d) => ({ label: d.name, value: d.id })),
  )

  const rulesOptions = computed(() =>
    gameRulesList.value.map((r) => ({ label: r.title, value: r.id })),
  )

  async function loadAll() {
    const loadOrgs = listOrganizations()
      .then((orgs) => {
        organizations.value = orgs
      })
      .catch(() => {})
    await Promise.all([listDisciplines(), loadRules(), loadOrgs])
  }

  return {
    disciplines,
    rules: gameRulesList,
    organizations,
    disciplineOptions,
    rulesOptions,
    loadAll,
  }
}
