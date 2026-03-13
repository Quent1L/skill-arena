<template>
  <div class="ranked-season-form-view p-4">
    <div class="flex items-center gap-3 mb-6">
      <Button icon="fa fa-arrow-left" text rounded @click="router.push('/admin/ranked')" />
      <h1 class="text-2xl font-bold">
        {{ isEditMode ? 'Modifier la saison ranked' : 'Nouvelle saison ranked' }}
      </h1>
    </div>

    <Message v-if="error" severity="error" :closable="true" class="mb-4">
      {{ error }}
    </Message>

    <form @submit.prevent="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <!-- Informations générales -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">Informations générales</h2>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <!-- Nom -->
              <div>
                <label for="name" class="block text-sm font-medium mb-2">
                  Nom de la saison <span class="text-red-500">*</span>
                </label>
                <InputText
                  id="name"
                  v-model="form.name"
                  class="w-full"
                  :class="{ 'p-invalid': formErrors.name }"
                  placeholder="Ex: Saison 1 - Billard 2026"
                />
                <small class="p-error">{{ formErrors.name }}</small>
              </div>

              <!-- Discipline -->
              <div>
                <label for="disciplineId" class="block text-sm font-medium mb-2">
                  Discipline <span class="text-red-500">*</span>
                </label>
                <Select
                  v-if="!isEditMode"
                  id="disciplineId"
                  v-model="form.disciplineId"
                  :options="disciplineOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Sélectionner une discipline"
                  class="w-full"
                  :class="{ 'p-invalid': formErrors.disciplineId }"
                />
                <InputText
                  v-else
                  :value="currentSeason?.discipline?.name ?? ''"
                  disabled
                  class="w-full"
                />
                <small class="p-error">{{ formErrors.disciplineId }}</small>
              </div>

              <!-- Date de début -->
              <div>
                <label for="startDate" class="block text-sm font-medium mb-2">
                  Date de début <span class="text-red-500">*</span>
                </label>
                <DatePicker
                  id="startDate"
                  v-model="startDateObj"
                  date-format="dd/mm/yy"
                  class="w-full"
                  :class="{ 'p-invalid': formErrors.startDate }"
                />
                <small class="p-error">{{ formErrors.startDate }}</small>
              </div>

              <!-- Date de fin -->
              <div>
                <label for="endDate" class="block text-sm font-medium mb-2">
                  Date de fin <span class="text-red-500">*</span>
                </label>
                <DatePicker
                  id="endDate"
                  v-model="endDateObj"
                  date-format="dd/mm/yy"
                  class="w-full"
                  :class="{ 'p-invalid': formErrors.endDate }"
                />
                <small class="p-error">{{ formErrors.endDate }}</small>
              </div>

              <!-- Taille min équipe -->
              <div>
                <label for="minTeamSize" class="block text-sm font-medium mb-2">
                  Taille min équipe <span class="text-red-500">*</span>
                </label>
                <InputNumber
                  id="minTeamSize"
                  v-model="form.minTeamSize"
                  :min="1"
                  :max="10"
                  class="w-full"
                />
              </div>

              <!-- Taille max équipe -->
              <div>
                <label for="maxTeamSize" class="block text-sm font-medium mb-2">
                  Taille max équipe <span class="text-red-500">*</span>
                </label>
                <InputNumber
                  id="maxTeamSize"
                  v-model="form.maxTeamSize"
                  :min="1"
                  :max="10"
                  class="w-full"
                />
              </div>

              <!-- Règles du jeu -->
              <div>
                <label for="rulesId" class="block text-sm font-medium mb-2"> Règles du jeu </label>
                <Select
                  id="rulesId"
                  v-model="form.rulesId"
                  :options="rulesOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Aucun règlement"
                  :show-clear="true"
                  class="w-full"
                />
              </div>
            </div>

            <!-- Description -->
            <div class="mt-4">
              <label for="description" class="block text-sm font-medium mb-2">Description</label>
              <Textarea
                id="description"
                v-model="form.description"
                rows="3"
                class="w-full"
                placeholder="Description optionnelle de la saison"
              />
            </div>
          </div>

          <!-- Configuration Ranked -->
          <div class="mb-6">
            <h2 class="text-xl font-semibold mb-4">Configuration Elo</h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <!-- MMR de base -->
              <div>
                <label for="baseMmr" class="block text-sm font-medium mb-2">MMR de base</label>
                <InputNumber
                  id="baseMmr"
                  v-model="form.baseMmr"
                  :min="100"
                  :max="5000"
                  class="w-full"
                />
              </div>

              <!-- Facteur K -->
              <div>
                <label for="kFactor" class="block text-sm font-medium mb-2">Facteur K</label>
                <InputNumber
                  id="kFactor"
                  v-model="form.kFactor"
                  :min="8"
                  :max="128"
                  class="w-full"
                />
              </div>

              <!-- Matchs de placement -->
              <div>
                <label for="placementMatches" class="block text-sm font-medium mb-2">
                  Matchs de placement
                </label>
                <InputNumber
                  id="placementMatches"
                  v-model="form.placementMatches"
                  :min="1"
                  :max="20"
                  class="w-full"
                />
              </div>
            </div>

            <div class="flex flex-col gap-3 mt-4">
              <div class="flex items-center gap-2">
                <Checkbox id="usePreviousMmr" v-model="form.usePreviousMmr" :binary="true" />
                <label for="usePreviousMmr" class="text-sm">
                  Reprendre le MMR de la saison précédente (soft reset)
                </label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="allowAsymmetricMatches"
                  v-model="form.allowAsymmetricMatches"
                  :binary="true"
                />
                <label for="allowAsymmetricMatches" class="text-sm">
                  Autoriser les matchs asymétriques (équipes de tailles différentes)
                </label>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button
              label="Annuler"
              severity="secondary"
              @click="router.push('/admin/ranked')"
              :disabled="loading"
              class="w-full sm:w-auto"
            />
            <Button
              type="submit"
              :label="isEditMode ? 'Mettre à jour' : 'Créer la saison'"
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRankedService } from '@/composables/ranked/ranked.service'
import { useDisciplineService } from '@/composables/discipline/discipline.service'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'

const router = useRouter()
const route = useRoute()

const {
  currentSeason,
  loading,
  error,
  loadSeasonById,
  createSeason,
  updateSeason,
} = useRankedService()

const { disciplines, listDisciplines } = useDisciplineService()
const { rules: gameRulesList, loadRules } = useGameRulesService()

const isEditMode = computed(() => !!route.params.id && route.params.id !== 'new')

const startDateObj = ref<Date | null>(null)
const endDateObj = ref<Date | null>(null)

const form = ref({
  name: '',
  description: '',
  disciplineId: '',
  startDate: '',
  endDate: '',
  minTeamSize: 1,
  maxTeamSize: 2,
  rulesId: null as string | null,
  baseMmr: 1000,
  kFactor: 32,
  placementMatches: 5,
  usePreviousMmr: false,
  allowAsymmetricMatches: false,
})

const formErrors = ref<Record<string, string>>({})

const disciplineOptions = computed(() =>
  disciplines.value.map((d) => ({ label: d.name, value: d.id })),
)

const rulesOptions = computed(() => [
  ...gameRulesList.value.map((r) => ({ label: r.title, value: r.id })),
])

watch(startDateObj, (val) => {
  form.value.startDate = val ? val.toISOString().split('T')[0] : ''
})

watch(endDateObj, (val) => {
  form.value.endDate = val ? val.toISOString().split('T')[0] : ''
})

function validate(): boolean {
  formErrors.value = {}
  if (!form.value.name || form.value.name.length < 3) {
    formErrors.value.name = 'Le nom doit contenir au moins 3 caractères'
  }
  if (!isEditMode.value && !form.value.disciplineId) {
    formErrors.value.disciplineId = 'La discipline est requise'
  }
  if (!form.value.startDate) {
    formErrors.value.startDate = 'La date de début est requise'
  }
  if (!form.value.endDate) {
    formErrors.value.endDate = 'La date de fin est requise'
  }
  if (form.value.startDate && form.value.endDate && form.value.startDate >= form.value.endDate) {
    formErrors.value.endDate = 'La date de fin doit être après la date de début'
  }
  return Object.keys(formErrors.value).length === 0
}

async function onSubmit() {
  if (!validate()) return

  if (isEditMode.value) {
    const id = route.params.id as string
    const success = await updateSeason(id, {
      name: form.value.name,
      description: form.value.description || undefined,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      rulesId: form.value.rulesId,
      baseMmr: form.value.baseMmr,
      kFactor: form.value.kFactor,
      placementMatches: form.value.placementMatches,
      usePreviousMmr: form.value.usePreviousMmr,
      allowAsymmetricMatches: form.value.allowAsymmetricMatches,
    })
    if (success) router.push('/admin/ranked')
  } else {
    const season = await createSeason({
      name: form.value.name,
      description: form.value.description || undefined,
      disciplineId: form.value.disciplineId,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      minTeamSize: form.value.minTeamSize,
      maxTeamSize: form.value.maxTeamSize,
      rulesId: form.value.rulesId,
      baseMmr: form.value.baseMmr,
      kFactor: form.value.kFactor,
      placementMatches: form.value.placementMatches,
      usePreviousMmr: form.value.usePreviousMmr,
      allowAsymmetricMatches: form.value.allowAsymmetricMatches,
    })
    if (season) router.push('/admin/ranked')
  }
}

onMounted(async () => {
  await Promise.all([listDisciplines(), loadRules()])
  if (isEditMode.value) {
    const id = route.params.id as string
    await loadSeasonById(id)
    if (currentSeason.value) {
      const s = currentSeason.value
      form.value.name = s.name
      form.value.description = s.description ?? ''
      form.value.rulesId = s.rulesId ?? null
      form.value.minTeamSize = s.minTeamSize
      form.value.maxTeamSize = s.maxTeamSize
      if (s.startDate) {
        startDateObj.value = new Date(s.startDate)
        form.value.startDate = s.startDate
      }
      if (s.endDate) {
        endDateObj.value = new Date(s.endDate)
        form.value.endDate = s.endDate
      }
      if (s.rankedConfig) {
        form.value.baseMmr = s.rankedConfig.baseMmr
        form.value.kFactor = s.rankedConfig.kFactor
        form.value.placementMatches = s.rankedConfig.placementMatches
        form.value.usePreviousMmr = s.rankedConfig.usePreviousMmr
        form.value.allowAsymmetricMatches = s.rankedConfig.allowAsymmetricMatches
      }
    }
  }
})
</script>

<style scoped>
.ranked-season-form-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
