<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Nom du tournoi -->
    <div>
      <FormTooltip
        label="Nom du tournoi"
        tooltip="Le nom de votre tournoi tel qu'il apparaîtra aux participants"
        for-id="name"
        required
      />
      <InputText
        id="name"
        v-model="formData.name"
        class="w-full mt-1"
        placeholder="Ex: Championnat d'Été 2024"
        :disabled="loading"
        required
      />
    </div>

    <!-- Type de tournoi -->
    <div>
      <FormTooltip
        label="Type de tournoi"
        tooltip="Championship: tous contre tous avec classement par points. Bracket: élimination directe"
        for-id="type"
        required
      />
      <Select
        id="type"
        v-model="formData.type"
        :options="tournamentTypes"
        option-label="label"
        option-value="value"
        class="w-full mt-1"
        placeholder="Sélectionner un type"
        :disabled="loading || isEditMode"
      />
      <small v-if="isEditMode" class="">
        Le type de tournoi ne peut pas être modifié après la création
      </small>
    </div>

    <!-- Description -->
    <div>
      <FormTooltip
        label="Description"
        tooltip="Une description optionnelle pour donner plus de détails sur votre tournoi"
        for-id="description"
      />
      <Textarea
        id="description"
        v-model="formData.description"
        class="w-full mt-1"
        rows="3"
        placeholder="Décrivez votre tournoi..."
        :disabled="loading"
      />
    </div>

    <!-- Taille des équipes -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <FormTooltip
          label="Taille min. d'équipe"
          tooltip="Nombre minimum de joueurs par équipe (1 pour des joueurs individuels)"
          for-id="minTeamSize"
          required
        />
        <InputNumber
          id="minTeamSize"
          v-model="formData.minTeamSize"
          class="w-full mt-1"
          :min="1"
          :max="formData.maxTeamSize || 50"
          :disabled="loading"
          required
        />
      </div>

      <div>
        <FormTooltip
          label="Taille max. d'équipe"
          tooltip="Nombre maximum de joueurs par équipe"
          for-id="maxTeamSize"
          required
        />
        <InputNumber
          id="maxTeamSize"
          v-model="formData.maxTeamSize"
          class="w-full mt-1"
          :min="formData.minTeamSize || 1"
          :max="50"
          :disabled="loading"
          required
        />
      </div>
    </div>

    <!-- Flexibilité des équipes -->
    <div>
      <FormTooltip
        label="Flexibilité des équipes"
        tooltip="Fixed: composition d'équipe fixe pour tout le tournoi. Dynamic: les joueurs peuvent changer d'équipe entre les matchs"
        for-id="teamFlexibility"
      />
      <Select
        id="teamFlexibility"
        v-model="formData.teamFlexibility"
        :options="flexibilityOptions"
        option-label="label"
        option-value="value"
        class="w-full mt-1"
        placeholder="Sélectionner"
        :disabled="loading || isEditMode"
      />
      <small v-if="isEditMode" class="">
        La flexibilité ne peut pas être modifiée après la création
      </small>
    </div>

    <!-- Limite de répétition d'équipe (si dynamic) -->
    <div v-if="formData.teamFlexibility === 'dynamic'">
      <FormTooltip
        label="Limite de répétition"
        tooltip="Nombre maximum de fois qu'une même composition d'équipe peut jouer ensemble (laisser vide pour illimité)"
        for-id="teamRepeatLimit"
      />
      <InputNumber
        id="teamRepeatLimit"
        v-model="formData.teamRepeatLimit"
        class="w-full mt-1"
        :min="1"
        placeholder="Illimité"
        :disabled="loading"
      />
    </div>

    <!-- Configuration des points (championship uniquement) -->
    <div v-if="formData.type === 'championship'" class="space-y-4">
      <h3 class="text-lg font-semibold border-b pb-2">Configuration des points</h3>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <FormTooltip
            label="Points victoire"
            tooltip="Points accordés pour une victoire"
            for-id="pointsWin"
          />
          <InputNumber
            id="pointsWin"
            v-model="formData.pointsWin"
            class="w-full mt-1"
            :min="0"
            :disabled="loading"
            :step="0.5"
          />
        </div>

        <div>
          <FormTooltip
            label="Points match nul"
            tooltip="Points accordés pour un match nul (si activé)"
            for-id="pointsDraw"
          />
          <InputNumber
            id="pointsDraw"
            v-model="formData.pointsDraw"
            class="w-full mt-1"
            :min="0"
            :disabled="loading || !formData.allowDraws"
            :step="0.5"
          />
        </div>

        <div>
          <FormTooltip
            label="Points défaite"
            tooltip="Points accordés pour une défaite (généralement 0)"
            for-id="pointsLoss"
          />
          <InputNumber
            id="pointsLoss"
            v-model="formData.pointsLoss"
            class="w-full mt-1"
            :min="0"
            :disabled="loading"
            :step="0.5"
          />
        </div>
      </div>

      <!-- Autoriser les matchs nuls -->
      <div class="flex items-center gap-2">
        <Checkbox
          id="allowDraws"
          v-model="formData.allowDraws"
          :binary="true"
          :disabled="loading"
        />
        <label for="allowDraws" class="cursor-pointer"> Autoriser les matchs nuls </label>
        <i
          v-tooltip.top="
            'Si activé, les matchs peuvent se terminer par un match nul sans prolongations'
          "
          class="fa-solid fa-circle-info text-gray-400 hover:text-gray-600 cursor-help text-xs"
        />
      </div>

      <!-- Score maximum -->
      <div>
        <FormTooltip
          label="Score maximum"
          tooltip="Limite de score par match (laisser vide pour illimité)"
          for-id="maxScore"
        />
        <InputNumber
          id="maxScore"
          v-model="formData.maxScore"
          class="w-full mt-1"
          :min="1"
          placeholder="Illimité"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Dates -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold border-b pb-2">Dates du tournoi</h3>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <FormTooltip
            label="Date de début"
            tooltip="Date et heure de début du tournoi"
            for-id="startDate"
            required
          />
          <DatePicker
            id="startDate"
            v-model="formData.startDate"
            class="w-full mt-1"
            show-time
            hourFormat="24"
            date-format="dd/mm/yy"
            :disabled="loading"
            required
          />
        </div>

        <div>
          <FormTooltip
            label="Date de fin"
            tooltip="Date et heure de fin prévue du tournoi"
            for-id="endDate"
            required
          />
          <DatePicker
            id="endDate"
            v-model="formData.endDate"
            class="w-full mt-1"
            show-time
            hourFormat="24"
            date-format="dd/mm/yy"
            :min-date="formData.startDate"
            :disabled="loading"
            required
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        label="Annuler"
        severity="secondary"
        outlined
        @click="$emit('cancel')"
        :disabled="loading"
      />
      <Button
        type="submit"
        :label="isEditMode ? 'Modifier' : 'Créer'"
        :loading="loading"
        icon="fa-solid fa-check"
      />
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import FormTooltip from './ui/FormTooltip.vue'
import type { Tournament, TournamentCreate, TournamentType, TeamFlexibility } from '@/types'

interface Props {
  tournament?: Tournament
  loading?: boolean
}

interface Emits {
  (e: 'submit', data: TournamentCreate): void
  (e: 'cancel'): void
}

// Interface locale avec camelCase pour le formulaire
interface TournamentFormData {
  name: string
  type: TournamentType
  description?: string
  minTeamSize: number
  maxTeamSize: number
  allowDraws: boolean
  pointsWin?: number
  pointsDraw?: number
  pointsLoss?: number
  maxScore?: number
  teamFlexibility?: TeamFlexibility
  teamRepeatLimit?: number
  startDate: Date
  endDate: Date
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isEditMode = computed(() => !!props.tournament)

const tournamentTypes = [
  { label: 'Championship (Tous contre tous)', value: 'championship' },
  { label: 'Bracket (Élimination directe)', value: 'bracket' },
]

const flexibilityOptions = [
  { label: 'Fixe - Équipes permanentes', value: 'fixed' },
  { label: 'Dynamique - Équipes variables', value: 'dynamic' },
]

const formData = ref<TournamentFormData>({
  name: '',
  type: 'championship',
  description: '',
  minTeamSize: 1,
  maxTeamSize: 1,
  allowDraws: false,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  maxScore: undefined,
  teamFlexibility: 'fixed',
  teamRepeatLimit: undefined,
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 jours
})

// Charger les données du tournoi si en mode édition
watch(
  () => props.tournament,
  (tournament) => {
    if (tournament) {
      formData.value = {
        name: tournament.name,
        type: tournament.type,
        description: tournament.description,
        minTeamSize: tournament.min_team_size,
        maxTeamSize: tournament.max_team_size,
        allowDraws: tournament.allow_draws,
        pointsWin: tournament.points_win,
        pointsDraw: tournament.points_draw,
        pointsLoss: tournament.points_loss,
        maxScore: tournament.max_score,
        teamFlexibility: tournament.team_flexibility,
        teamRepeatLimit: tournament.team_repeat_limit,
        startDate: new Date(tournament.start_date),
        endDate: new Date(tournament.end_date),
      }
    }
  },
  { immediate: true },
)

// Si allowDraws est désactivé, mettre pointsDraw à 0
watch(
  () => formData.value.allowDraws,
  (allowDraws) => {
    if (!allowDraws) {
      formData.value.pointsDraw = 0
    }
  },
)

const handleSubmit = () => {
  // Convertir les données du formulaire au format API (snake_case)
  const data: TournamentCreate = {
    name: formData.value.name,
    type: formData.value.type,
    description: formData.value.description,
    min_team_size: formData.value.minTeamSize,
    max_team_size: formData.value.maxTeamSize,
    allow_draws: formData.value.allowDraws,
    points_win: formData.value.pointsWin,
    points_draw: formData.value.pointsDraw,
    points_loss: formData.value.pointsLoss,
    max_score: formData.value.maxScore,
    team_flexibility: formData.value.teamFlexibility,
    team_repeat_limit: formData.value.teamRepeatLimit,
    start_date: formData.value.startDate.toISOString(),
    end_date: formData.value.endDate.toISOString(),
  }

  emit('submit', data)
}
</script>
