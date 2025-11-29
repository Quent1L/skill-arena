import { ref } from 'vue'
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
import { useToast } from 'primevue/usetoast'

export function useDisciplineService() {
  const toast = useToast()

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
        err instanceof Error ? err.message : 'Erreur lors du chargement des disciplines'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        err instanceof Error ? err.message : 'Erreur lors du chargement de la discipline'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Discipline créée avec succès',
        life: 3000,
      })
      return discipline
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la création de la discipline'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Discipline mise à jour avec succès',
        life: 3000,
      })
      if (currentDiscipline.value?.id === id) {
        currentDiscipline.value = discipline
      }
      return discipline
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la discipline'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Discipline supprimée avec succès',
        life: 3000,
      })
      if (currentDiscipline.value?.id === id) {
        currentDiscipline.value = null
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la suppression de la discipline'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Type de résultat créé avec succès',
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
      return outcomeType
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la création du type de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Type de résultat mis à jour avec succès',
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
      return outcomeType
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour du type de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Type de résultat supprimé avec succès',
        life: 3000,
      })
      if (currentDiscipline.value) {
        await loadOutcomeTypes(currentDiscipline.value.id)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la suppression du type de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Raison de résultat créée avec succès',
        life: 3000,
      })
      return outcomeReason
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la création de la raison de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Raison de résultat mise à jour avec succès',
        life: 3000,
      })
      return outcomeReason
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la mise à jour de la raison de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
        summary: 'Succès',
        detail: 'Raison de résultat supprimée avec succès',
        life: 3000,
      })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erreur lors de la suppression de la raison de résultat'
      error.value = message
      toast.add({
        severity: 'error',
        summary: 'Erreur',
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
