import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { disciplineApi } from './discipline.api'
import { outcomeTypeApi } from '../outcome-type.api'
import { outcomeReasonApi, type OutcomeReasonResponse } from '../outcome-reason.api'
import type {
  CreateDisciplineRequestData,
  UpdateDisciplineRequestData,
  CreateOutcomeTypeRequestData,
  UpdateOutcomeTypeRequestData,
  CreateOutcomeReasonRequestData,
  UpdateOutcomeReasonRequestData,
  Discipline,
  OutcomeType,
} from '@skill-arena/shared/types/index'
import { useAppToast } from '@/composables/useAppToast'

export function useDisciplineService() {
  const toast = useAppToast()
  const { t } = useI18n()

  const disciplines = ref<Discipline[]>([])
  const currentDiscipline = ref<Discipline | null>(null)
  const outcomeTypes = ref<OutcomeType[]>([])
  const outcomeReasons = ref<OutcomeReasonResponse[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listDisciplines() {
    try {
      loading.value = true
      error.value = null
      disciplines.value = await disciplineApi.list()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.listFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
    } finally {
      loading.value = false
    }
  }

  async function getDiscipline(id: string) {
    try {
      loading.value = true
      error.value = null
      currentDiscipline.value = await disciplineApi.getById(id)
      await loadOutcomeTypes(id)
      return currentDiscipline.value
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.getFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createDiscipline(data: CreateDisciplineRequestData) {
    try {
      loading.value = true
      error.value = null
      const discipline = await disciplineApi.create(data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.createSuccess'),
        life: 3000,
      })
      return discipline
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.createFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateDiscipline(id: string, data: UpdateDisciplineRequestData) {
    try {
      loading.value = true
      error.value = null
      const discipline = await disciplineApi.update(id, data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.updateSuccess'),
        life: 3000,
      })
      if (currentDiscipline.value?.id === id) {
        currentDiscipline.value = discipline
      }
      return discipline
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.updateFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteDiscipline(id: string) {
    try {
      loading.value = true
      error.value = null
      await disciplineApi.delete(id)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.deleteSuccess'),
        life: 3000,
      })
      if (currentDiscipline.value?.id === id) {
        currentDiscipline.value = null
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.deleteFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadOutcomeTypes(disciplineId: string) {
    try {
      outcomeTypes.value = await outcomeTypeApi.list(disciplineId)
    } catch (err) {
      console.error('Erreur lors du chargement des types de résultat:', err)
    }
  }

  async function createOutcomeType(data: CreateOutcomeTypeRequestData) {
    try {
      loading.value = true
      error.value = null
      const outcomeType = await outcomeTypeApi.create(data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeTypeCreateSuccess'),
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
      return outcomeType
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.outcomeTypeCreateFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateOutcomeType(id: string, data: UpdateOutcomeTypeRequestData) {
    try {
      loading.value = true
      error.value = null
      const outcomeType = await outcomeTypeApi.update(id, data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeTypeUpdateSuccess'),
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
      return outcomeType
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.outcomeTypeUpdateFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteOutcomeType(id: string) {
    try {
      loading.value = true
      error.value = null
      await outcomeTypeApi.delete(id)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeTypeDeleteSuccess'),
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.outcomeTypeDeleteFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadOutcomeReasons(outcomeTypeId: string) {
    try {
      const newReasons = await outcomeReasonApi.list(outcomeTypeId)
      // Fusionner les nouvelles raisons avec les existantes, en remplaçant celles du même type
      outcomeReasons.value = [
        ...outcomeReasons.value.filter((r) => r.outcomeTypeId !== outcomeTypeId),
        ...newReasons,
      ]
    } catch (err) {
      console.error('Erreur lors du chargement des raisons de résultat:', err)
    }
  }

  async function createOutcomeReason(data: CreateOutcomeReasonRequestData) {
    try {
      loading.value = true
      error.value = null
      const outcomeReason = await outcomeReasonApi.create(data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeReasonCreateSuccess'),
        life: 3000,
      })
      return outcomeReason
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('disciplineService.errors.outcomeReasonCreateFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateOutcomeReason(id: string, data: UpdateOutcomeReasonRequestData) {
    try {
      loading.value = true
      error.value = null
      const outcomeReason = await outcomeReasonApi.update(id, data)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeReasonUpdateSuccess'),
        life: 3000,
      })
      return outcomeReason
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('disciplineService.errors.outcomeReasonUpdateFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteOutcomeReason(id: string) {
    try {
      loading.value = true
      error.value = null
      await outcomeReasonApi.delete(id)
      toast.add({
        severity: 'success',
        summary: t('common.success'),
        detail: t('disciplineService.toast.outcomeReasonDeleteSuccess'),
        life: 3000,
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('disciplineService.errors.outcomeReasonDeleteFailed')
      error.value = message
      toast.add({
        severity: 'error',
        summary: t('common.error'),
        detail: message,
        life: 5000,
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    disciplines,
    currentDiscipline,
    outcomeTypes,
    outcomeReasons,
    loading,
    error,
    listDisciplines,
    getDiscipline,
    createDiscipline,
    updateDiscipline,
    deleteDiscipline,
    loadOutcomeTypes,
    createOutcomeType,
    updateOutcomeType,
    deleteOutcomeType,
    loadOutcomeReasons,
    createOutcomeReason,
    updateOutcomeReason,
    deleteOutcomeReason,
  }
}
