<template>
  <div class="tournament-form-view p-4">
    <Message v-if="error" severity="error" :closable="true">
      {{ error }}
    </Message>

    <form @submit="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <!-- Informations générales -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">Informations générales</h2>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <!-- Nom -->
              <div>
                <label for="name" class="block text-sm font-medium mb-2">
                  Nom du tournoi <span class="text-red-500">*</span>
                </label>
                <InputText
                  id="name"
                  v-model="name"
                  :disabled="!isFieldEditable('name')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.name }"
                />
                <small class="p-error">{{ errors.name }}</small>
              </div>

              <!-- Status -->
              <div v-if="isEditMode">
                <label for="status" class="block text-sm font-medium mb-2"> Statut </label>
                <Select
                  id="status"
                  v-model="status"
                  :options="statusOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!isFieldEditable('status')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.status }"
                />
                <small class="p-error">{{ errors.status }}</small>
              </div>

              <!-- Discipline -->
              <div>
                <label for="disciplineId" class="block text-sm font-medium mb-2">
                  Discipline <span class="text-red-500">*</span>
                </label>
                <Select
                  v-if="!isEditMode"
                  id="disciplineId"
                  v-model="disciplineId"
                  :options="disciplineOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Sélectionner une discipline"
                  class="w-full"
                  :class="{ 'p-invalid': errors.disciplineId }"
                />
                <InputText
                  v-else
                  id="disciplineId"
                  :value="currentDisciplineName"
                  disabled
                  class="w-full"
                />
                <small class="p-error">{{ errors.disciplineId }}</small>
              </div>

              <!-- Description -->
              <div class="lg:col-span-2">
                <label for="description" class="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  id="description"
                  v-model="description"
                  :disabled="!isFieldEditable('description')"
                  rows="3"
                  class="w-full"
                  :class="{ 'p-invalid': errors.description }"
                />
                <small class="p-error">{{ errors.description }}</small>
              </div>

              <!-- Mode -->
              <div>
                <label for="mode" class="block text-sm font-medium mb-2">
                  Mode <span class="text-red-500">*</span>
                </label>
                <Select
                  id="mode"
                  v-model="mode"
                  :options="modeOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!isFieldEditable('mode')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.mode }"
                />
                <small class="p-error">{{ errors.mode }}</small>
              </div>

              <!-- Team Mode -->
              <div>
                <label for="teamMode" class="block text-sm font-medium mb-2">
                  Formation d'équipe <span class="text-red-500">*</span>
                </label>
                <Select
                  id="teamMode"
                  v-model="teamMode"
                  :options="teamModeOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!isFieldEditable('teamMode')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.teamMode }"
                />
                <small class="p-error">{{ errors.teamMode }}</small>
              </div>

              <!-- Min Team Size -->
              <div>
                <label for="minTeamSize" class="block text-sm font-medium mb-2">
                  Taille min d'équipe <span class="text-red-500">*</span>
                </label>
                <InputNumber
                  id="minTeamSize"
                  v-model="minTeamSize"
                  :min="1"
                  :disabled="!isFieldEditable('minTeamSize')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.minTeamSize }"
                />
                <small class="p-error">{{ errors.minTeamSize }}</small>
              </div>
              <!-- Max Team Size -->
              <div>
                <label for="teamSize" class="block text-sm font-medium mb-2">
                  Taille max d'équipe <span class="text-red-500">*</span>
                </label>
                <InputNumber
                  id="maxTeamSize"
                  v-model="maxTeamSize"
                  :min="1"
                  :max="10"
                  :disabled="!isFieldEditable('maxTeamSize')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.maxTeamSize }"
                />
                <small class="p-error">{{ errors.maxTeamSize }}</small>
              </div>

              <!-- Dates -->
              <div>
                <label for="startDate" class="block text-sm font-medium mb-2">
                  Date de début <span class="text-red-500">*</span>
                </label>
                <DatePicker
                  id="startDate"
                  v-model="startDate"
                  date-format="dd/mm/yy"
                  :disabled="!isFieldEditable('startDate')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.startDate }"
                />
                <small class="p-error">{{ errors.startDate }}</small>
              </div>

              <div>
                <label for="endDate" class="block text-sm font-medium mb-2">
                  Date de fin <span class="text-red-500">*</span>
                </label>
                <DatePicker
                  id="endDate"
                  v-model="endDate"
                  date-format="dd/mm/yy"
                  :disabled="!isFieldEditable('endDate')"
                  class="w-full"
                  :class="{ 'p-invalid': errors.endDate }"
                />
                <small class="p-error">{{ errors.endDate }}</small>
              </div>
            </div>
          </div>

          <!-- Règles du championnat -->
          <div v-if="mode === 'championship'" class="mb-6">
            <h2 class="text-xl font-semibold mb-4">Règles du championnat</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label for="maxMatchesPerPlayer" class="block text-sm font-medium mb-2">
                  Matchs max par joueur
                </label>
                <InputNumber
                  id="maxMatchesPerPlayer"
                  v-model="maxMatchesPerPlayer"
                  :min="1"
                  :max="100"
                  :disabled="!isFieldEditable('maxMatchesPerPlayer')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="maxTimesWithSamePartner" class="block text-sm font-medium mb-2">
                  Max avec même partenaire
                </label>
                <InputNumber
                  id="maxTimesWithSamePartner"
                  v-model="maxTimesWithSamePartner"
                  :min="1"
                  :max="10"
                  :disabled="!isFieldEditable('maxTimesWithSamePartner')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="maxTimesWithSameOpponent" class="block text-sm font-medium mb-2">
                  Max contre même adversaire
                </label>
                <InputNumber
                  id="maxTimesWithSameOpponent"
                  v-model="maxTimesWithSameOpponent"
                  :min="1"
                  :max="10"
                  :disabled="!isFieldEditable('maxTimesWithSameOpponent')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="pointPerVictory" class="block text-sm font-medium mb-2">
                  Points par victoire
                </label>
                <InputNumber
                  id="pointPerVictory"
                  v-model="pointPerVictory"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerVictory')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="pointPerDraw" class="block text-sm font-medium mb-2">
                  Points par match nul
                </label>
                <InputNumber
                  id="pointPerDraw"
                  v-model="pointPerDraw"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerDraw')"
                  class="w-full"
                />
              </div>

              <div>
                <label for="pointPerLoss" class="block text-sm font-medium mb-2">
                  Points par défaite
                </label>
                <InputNumber
                  id="pointPerLoss"
                  v-model="pointPerLoss"
                  :min="0"
                  :disabled="!isFieldEditable('pointPerLoss')"
                  class="w-full"
                />
              </div>

              <div class="sm:col-span-2 lg:col-span-3">
                <div class="flex items-center">
                  <Checkbox
                    id="allowDraw"
                    v-model="allowDraw"
                    :binary="true"
                    :disabled="!isFieldEditable('allowDraw')"
                  />
                  <label for="allowDraw" class="ml-2"> Autoriser les matchs nuls </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              label="Annuler"
              severity="secondary"
              @click="router.back()"
              :disabled="loading"
              class="w-full sm:w-auto"
            />
            <Button
              type="submit"
              :label="isEditMode ? 'Mettre à jour' : 'Créer'"
              icon="fa fa-check"
              :loading="loading"
              class="w-full sm:w-auto"
            />
          </div>
        </template>
      </Card>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import {
  type CreateTournamentFormData,
  type UpdateTournamentFormData,
  baseTournamentFormSchema,
  baseTournamentUpdateFormSchema,
} from '@skill-arena/shared/types/index'
import { useTournamentService } from '@/composables/tournament/tournament.service'
import { useDisciplineService } from '@/composables/discipline/discipline.service'

const router = useRouter()
const route = useRoute()
const {
  currentTournament,
  loading,
  error,
  getTournament,
  createTournament,
  updateTournament,
  getEditableFields,
} = useTournamentService()

const { disciplines, listDisciplines } = useDisciplineService()

const isEditMode = computed(() => route.params.id !== 'new' && !!route.params.id)
const editableFields = ref<string[]>(['all'])

const disciplineOptions = computed(() => {
  return disciplines.value.map((d) => ({
    label: d.name,
    value: d.id,
  }))
})

const currentDisciplineName = computed(() => {
  return currentTournament.value?.discipline?.name || 'Non définie'
})

const modeOptions = [
  { label: 'Championnat', value: 'championship' },
  { label: 'Bracket', value: 'bracket' },
]

const teamModeOptions = [
  { label: 'Statique', value: 'static' },
  { label: 'Flexible', value: 'flex' },
]

const statusOptions = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'Ouvert aux inscriptions', value: 'open' },
  { label: 'En cours', value: 'ongoing' },
  { label: 'Terminé', value: 'finished' },
]

const { handleSubmit, defineField, errors, setValues } = useForm({
  validationSchema: toTypedSchema(
    isEditMode.value ? baseTournamentUpdateFormSchema : baseTournamentFormSchema,
  ),
})

const [name] = defineField('name')
const [description] = defineField('description')
const [mode] = defineField('mode')
const [teamMode] = defineField('teamMode')
const [status] = defineField('status')
const [minTeamSize] = defineField('minTeamSize')
const [maxTeamSize] = defineField('maxTeamSize')
const [maxMatchesPerPlayer] = defineField('maxMatchesPerPlayer')
const [maxTimesWithSamePartner] = defineField('maxTimesWithSamePartner')
const [maxTimesWithSameOpponent] = defineField('maxTimesWithSameOpponent')
const [pointPerVictory] = defineField('pointPerVictory')
const [pointPerDraw] = defineField('pointPerDraw')
const [pointPerLoss] = defineField('pointPerLoss')
const [allowDraw] = defineField('allowDraw')
const [startDate] = defineField('startDate')
const [endDate] = defineField('endDate')
const [disciplineId] = defineField('disciplineId')

function isFieldEditable(fieldName: string): boolean {
  if (!isEditMode.value) return true
  if (editableFields.value.includes('all')) return true
  return editableFields.value.includes(fieldName)
}

const onSubmit = handleSubmit(async (values) => {
  try {
    // Validation côté client des règles cross-field
    const formData = values as CreateTournamentFormData & UpdateTournamentFormData

    // Vérification des dates
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      throw new Error('La date de début doit être antérieure à la date de fin')
    }

    // Vérification des tailles d'équipe
    if (
      formData.minTeamSize &&
      formData.maxTeamSize &&
      formData.maxTeamSize < formData.minTeamSize
    ) {
      throw new Error('La taille maximale doit être supérieure ou égale à la taille minimale')
    }

    if (isEditMode.value && route.params.id) {
      // For update, exclude disciplineId (not editable after creation)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { disciplineId, ...updateData } = values
      await updateTournament(route.params.id as string, updateData as UpdateTournamentFormData)
    } else {
      // For create, cast to CreateTournamentFormData
      await createTournament(values as CreateTournamentFormData)
    }
    router.push('/admin/tournaments')
  } catch (err) {
    console.error('Erreur lors de la sauvegarde:', err)
    // L'erreur sera affichée via le state error du service
  }
})

onMounted(async () => {
  // Charger les disciplines pour le select
  await listDisciplines()

  if (isEditMode.value && route.params.id) {
    await getTournament(route.params.id as string)
    if (currentTournament.value) {
      editableFields.value = getEditableFields(currentTournament.value)
      setValues({
        name: currentTournament.value.name,
        description: currentTournament.value.description,
        mode: currentTournament.value.mode,
        teamMode: currentTournament.value.teamMode,
        status: currentTournament.value.status,
        minTeamSize: currentTournament.value.minTeamSize,
        maxTeamSize: currentTournament.value.maxTeamSize,
        maxMatchesPerPlayer: currentTournament.value.maxMatchesPerPlayer,
        maxTimesWithSamePartner: currentTournament.value.maxTimesWithSamePartner,
        maxTimesWithSameOpponent: currentTournament.value.maxTimesWithSameOpponent,
        pointPerVictory: currentTournament.value.pointPerVictory ?? 3,
        pointPerDraw: currentTournament.value.pointPerDraw ?? 1,
        pointPerLoss: currentTournament.value.pointPerLoss ?? 0,
        allowDraw: currentTournament.value.allowDraw ?? true,
        startDate: currentTournament.value.startDate,
        endDate: currentTournament.value.endDate,
        disciplineId: currentTournament.value.disciplineId,
      })
    }
  } else {
    // Set defaults for new tournament
    setValues({
      mode: 'championship',
      teamMode: 'flex',
      status: 'draft',
      minTeamSize: 1,
      maxTeamSize: 2,
      maxMatchesPerPlayer: 10,
      maxTimesWithSamePartner: 2,
      maxTimesWithSameOpponent: 2,
      pointPerVictory: 3,
      pointPerDraw: 1,
      pointPerLoss: 0,
      allowDraw: true,
    })
  }
})
</script>

<style scoped>
.tournament-form-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
