<template>
  <div class="standings-table">
    <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center gap-2">
        <SelectButton
          v-model="standingsType"
          :options="standingsTypeOptions"
          option-label="label"
          option-value="value"
          class="w-full sm:w-auto"
          size="small"
        />
      </div>
      <button
        class="group flex items-center gap-2 rounded-full px-2 py-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all duration-300 cursor-pointer"
        @click="infoVisible = true"
      >
        <i class="fa fa-circle-question text-sm" />
        <span
          class="overflow-hidden whitespace-nowrap text-xs font-medium max-w-0 group-hover:max-w-55 transition-all duration-500 ease-in-out"
          >Comment est calculé le classement ?</span
        >
      </button>
    </div>

    <Dialog
      v-model:visible="infoVisible"
      modal
      header="Comment est calculé le classement ?"
      :style="{ width: '90vw', maxWidth: '560px' }"
      :draggable="false"
    >
      <div class="space-y-5 text-sm text-gray-700 dark:text-gray-300">
        <section>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Points attribués</h3>
          <ul class="space-y-1">
            <li class="flex justify-between">
              <span>Victoire</span>
              <span class="font-medium text-green-600 dark:text-green-400"
                >{{ tournamentConfig?.pointPerVictory ?? 3 }} pts</span
              >
            </li>
            <li v-if="allowDraw" class="flex justify-between">
              <span>Match nul</span>
              <span class="font-medium text-gray-600 dark:text-gray-400"
                >{{ tournamentConfig?.pointPerDraw ?? 1 }} pts</span
              >
            </li>
            <li class="flex justify-between">
              <span>Défaite</span>
              <span class="font-medium text-red-600 dark:text-red-400"
                >{{ tournamentConfig?.pointPerLoss ?? 0 }} pts</span
              >
            </li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Critères de classement</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Appliqués dans cet ordre en cas d'égalité :
          </p>
          <ol class="space-y-1.5 list-decimal list-inside">
            <li>Points totaux</li>
            <li>Nombre de victoires</li>
            <li v-if="allowDraw">Ratio victoires / défaites</li>
            <li>Score Buchholz — somme des points de tous les adversaires rencontrés</li>
            <li>
              Confrontations directes —
              {{
                teamMode === 'flex'
                  ? 'résultats entre les joueurs à égalité'
                  : 'résultats entre les équipes à égalité'
              }}
            </li>
            <li>
              <span>Qualité des résultats</span>
              <div class="mt-1 ml-4 space-y-0.5">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Victoire = +pts, Défaite = −pts selon le type de résultat :
                </p>
                <template v-if="outcomeTypes.length > 0">
                  <ul class="text-xs space-y-0.5">
                    <li v-for="ot in outcomeTypes" :key="ot.id" class="flex justify-between gap-4">
                      <span class="text-gray-600 dark:text-gray-400">{{ ot.name }}</span>
                      <span class="font-medium">{{ ot.points }} pt</span>
                    </li>
                  </ul>
                </template>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                  3 pts par résultat par défaut
                </p>
              </div>
            </li>
            <li>Taux de victoire</li>
          </ol>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
            Classement officiel vs provisoire
          </h3>
          <ul class="space-y-1">
            <li>
              <span class="font-medium">Officiel</span> — uniquement les matchs finalisés par un
              arbitre
            </li>
            <li>
              <span class="font-medium">Provisoire</span> — matchs finalisés + matchs déclarés par
              les joueurs
            </li>
          </ul>
        </section>

        <section>
          <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Contraintes du tournoi</h3>

          <template v-if="isOneVsOne">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Format 1v1 — chaque participant joue individuellement.
            </p>
            <ul class="space-y-1">
              <li class="flex justify-between">
                <span>Max matchs par joueur</span>
                <span class="font-medium">{{ tournamentConfig?.maxMatchesPerPlayer ?? '—' }}</span>
              </li>
              <li class="flex justify-between">
                <span>Max rencontres avec le même adversaire</span>
                <span class="font-medium">{{
                  tournamentConfig?.maxTimesWithSameOpponent ?? '—'
                }}</span>
              </li>
              <li
                v-if="
                  scoreEnabled &&
                  (tournamentConfig?.minScore != null || tournamentConfig?.maxScore != null)
                "
                class="flex justify-between"
              >
                <span>Score autorisé</span>
                <span class="font-medium"
                  >{{ tournamentConfig?.minScore ?? 0 }} –
                  {{ tournamentConfig?.maxScore ?? '∞' }}</span
                >
              </li>
            </ul>
          </template>

          <template v-else-if="isFlexTeam">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Format équipes dynamiques — les équipes se forment librement à chaque match.
            </p>
            <ul class="space-y-1">
              <li class="flex justify-between">
                <span>Max matchs par joueur</span>
                <span class="font-medium">{{ tournamentConfig?.maxMatchesPerPlayer ?? '—' }}</span>
              </li>
              <li class="flex justify-between">
                <span>Taille d'équipe</span>
                <span class="font-medium"
                  >{{ tournamentConfig?.minTeamSize ?? '—' }}–{{
                    tournamentConfig?.maxTeamSize ?? '—'
                  }}
                  joueurs</span
                >
              </li>
              <li class="flex justify-between">
                <span>Max rencontres avec le même adversaire</span>
                <span class="font-medium">{{
                  tournamentConfig?.maxTimesWithSameOpponent ?? '—'
                }}</span>
              </li>
              <li class="flex justify-between">
                <span>Max rencontres avec le même partenaire</span>
                <span class="font-medium">{{
                  tournamentConfig?.maxTimesWithSamePartner ?? '—'
                }}</span>
              </li>
              <li
                v-if="
                  scoreEnabled &&
                  (tournamentConfig?.minScore != null || tournamentConfig?.maxScore != null)
                "
                class="flex justify-between"
              >
                <span>Score autorisé</span>
                <span class="font-medium"
                  >{{ tournamentConfig?.minScore ?? 0 }} –
                  {{ tournamentConfig?.maxScore ?? '∞' }}</span
                >
              </li>
            </ul>
          </template>

          <template v-else>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Format équipes fixes — la composition de chaque équipe est définie en amont.
            </p>
            <ul class="space-y-1">
              <li class="flex justify-between">
                <span>Max matchs par équipe</span>
                <span class="font-medium">{{ tournamentConfig?.maxMatchesPerPlayer ?? '—' }}</span>
              </li>
              <li class="flex justify-between">
                <span>Max rencontres avec la même équipe adverse</span>
                <span class="font-medium">{{
                  tournamentConfig?.maxTimesWithSameOpponent ?? '—'
                }}</span>
              </li>
              <li
                v-if="
                  scoreEnabled &&
                  (tournamentConfig?.minScore != null || tournamentConfig?.maxScore != null)
                "
                class="flex justify-between"
              >
                <span>Score autorisé</span>
                <span class="font-medium"
                  >{{ tournamentConfig?.minScore ?? 0 }} –
                  {{ tournamentConfig?.maxScore ?? '∞' }}</span
                >
              </li>
            </ul>
          </template>
        </section>
      </div>
    </Dialog>

    <Message v-if="error" severity="error" class="mb-4">
      {{ error }}
    </Message>

    <div
      v-if="standings.length === 0 && !loading"
      class="text-center py-8 text-gray-500 dark:text-gray-400"
    >
      Aucun classement disponible pour le moment
    </div>

    <div class="standings-container">
      <Transition name="standings-fade" mode="out-in">
        <div v-if="standings.length > 0" :key="`standings-${standingsType}`" class="relative">
          <DataTable :value="standings" class="p-datatable-sm" striped-rows :loading="loading">
            <Column field="rank" header="#" style="width: 4rem">
              <template #body="{ index }">
                <div class="flex items-center justify-center">
                  <i v-if="index === 0" class="fa fa-trophy text-yellow-500" title="Premier"></i>
                  <i v-if="index === 1" class="fa fa-medal text-gray-400" title="Deuxième"></i>
                  <i v-if="index === 2" class="fa fa-medal text-orange-600" title="Troisième"></i>
                  <span
                    :class="[
                      'font-semibold',
                      {
                        'text-yellow-500': index === 0,
                        'text-gray-400': index === 1,
                        'text-orange-600': index === 2,
                      },
                    ]"
                  >
                    {{ index + 1 }}
                  </span>
                </div>
              </template>
            </Column>

            <Column field="name" header="Nom">
              <template #body="{ data }">
                <RouterLink
                  v-if="teamMode === 'flex'"
                  :to="`/players/${data.id}`"
                  class="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  :title="data.name"
                >
                  <span class="md:hidden">{{ data.shortName }}</span
                  ><span class="hidden md:inline">{{ data.name }}</span>
                </RouterLink>
                <div v-else class="font-medium text-gray-900 dark:text-white" :title="data.name">
                  <span class="md:hidden">{{ data.shortName }}</span
                  ><span class="hidden md:inline">{{ data.name }}</span>
                </div>
              </template>
            </Column>

            <Column field="points" header="Pts">
              <template #body="{ data }">
                <div class="font-semibold text-blue-600 dark:text-blue-400">
                  {{ data.points }}
                </div>
              </template>
            </Column>

            <Column field="matchesPlayed" header="MJ">
              <template #body="{ data }">
                {{ data.matchesPlayed }}
              </template>
            </Column>

            <Column field="wins" header="V">
              <template #body="{ data }">
                <span class="text-green-600 dark:text-green-400 font-medium">
                  {{ data.wins }}
                </span>
              </template>
            </Column>

            <Column v-if="allowDraw" field="draws" header="N">
              <template #body="{ data }">
                <span class="text-gray-600 dark:text-gray-400 font-medium">
                  {{ data.draws }}
                </span>
              </template>
            </Column>

            <Column field="losses" header="D">
              <template #body="{ data }">
                <span class="text-red-600 dark:text-red-400 font-medium">
                  {{ data.losses }}
                </span>
              </template>
            </Column>

            <Column v-if="scoreEnabled" field="scored" header="BP">
              <template #body="{ data }">
                {{ data.scored }}
              </template>
            </Column>

            <Column v-if="scoreEnabled" field="conceded" header="BC">
              <template #body="{ data }">
                {{ data.conceded }}
              </template>
            </Column>

            <Column v-if="scoreEnabled" field="scoreDiff" header="Diff">
              <template #body="{ data }">
                <span
                  :class="[
                    'font-medium',
                    {
                      'text-green-600 dark:text-green-400': data.scoreDiff > 0,
                      'text-red-600 dark:text-red-400': data.scoreDiff < 0,
                      'text-gray-600 dark:text-gray-400': data.scoreDiff === 0,
                    },
                  ]"
                >
                  {{ data.scoreDiff > 0 ? '+' : '' }}{{ data.scoreDiff }}
                </span>
              </template>
            </Column>

            <Column
              v-if="allowDraw"
              field="winLossRatio"
              header="V/D"
              class="hidden md:table-cell"
              header-class="hidden md:table-cell"
            >
              <template #body="{ data }">
                <span class="text-gray-600 dark:text-gray-400">{{
                  formatRatio(data.winLossRatio)
                }}</span>
              </template>
            </Column>

            <Column
              field="buchholzScore"
              class="hidden md:table-cell"
              header-class="hidden md:table-cell"
            >
              <template #header>
                <span class="flex items-center gap-1">
                  Buchholz
                  <i
                    class="fa fa-circle-question text-xs text-gray-400 cursor-help"
                    v-tooltip.top="
                      'somme des points des adversaires (moyenne en équipe)'
                    "
                  />
                </span>
              </template>
              <template #body="{ data }">
                <span class="text-gray-600 dark:text-gray-400">{{ data.buchholzScore }}</span>
              </template>
            </Column>

            <Column
              field="victoryQuality"
              class="hidden md:table-cell"
              header-class="hidden md:table-cell"
            >
              <template #header>
                <span class="flex items-center gap-1">
                  Qualité des résultats
                  <i
                    class="fa fa-circle-question text-xs text-gray-400 cursor-help"
                    v-tooltip.top="
                      'Victoire = +pts\n Défaite = −pts \nselon le type de résultat'
                    "
                  />
                </span>
              </template>
              <template #body="{ data }">
                <span
                  class="text-gray-600 dark:text-gray-400 cursor-help"
                  @mouseenter="(e) => openQualityPanel(e, data)"
                  @mouseleave="qualityDetailPanel?.hide()"
                  >{{ Math.round(data.victoryQuality) }}</span
                >
              </template>
            </Column>

            <Column
              field="winRate"
              header="Win%"
              class="hidden md:table-cell"
              header-class="hidden md:table-cell"
            >
              <template #body="{ data }">
                <span class="text-gray-600 dark:text-gray-400">{{
                  formatPercent(data.winRate)
                }}</span>
              </template>
            </Column>

            <Column header="" style="width: 3rem" class="md:hidden" header-class="md:hidden">
              <template #body="{ data }">
                <Button
                  icon="fa fa-circle-info"
                  text
                  rounded
                  size="small"
                  class="text-gray-400 hover:text-blue-500"
                  :aria-label="`Détails départage ${data.name}`"
                  @click="(e) => toggleTiebreakerPanel(e, data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </Transition>
    </div>

    <Popover ref="tiebreakerPanel">
      <div v-if="selectedEntry" class="p-3 min-w-[220px]">
        <p class="font-semibold text-sm mb-2 text-gray-800 dark:text-gray-100">
          {{ selectedEntry.name }} — Critères de départage
        </p>
        <ul class="text-sm space-y-1 text-gray-700 dark:text-gray-300">
          <li v-if="allowDraw" class="flex items-center gap-4">
            <span class="flex-1">Ratio V/D</span>
            <span class="font-medium">{{ formatRatio(selectedEntry.winLossRatio) }}</span>
            <span class="w-4 shrink-0" />
          </li>
          <li class="flex items-center gap-4">
            <span class="flex-1">Buchholz</span>
            <span class="font-medium">{{ selectedEntry.buchholzScore }} pts</span>
            <span class="w-4 shrink-0" />
          </li>
          <li>
            <button
              class="flex items-center gap-4 w-full text-left"
              @click="qualityExpanded = !qualityExpanded"
            >
              <span class="flex-1">Qual. résultats</span>
              <span class="font-medium">{{ selectedEntry.victoryQuality.toFixed(1) }} pts</span>
              <span class="w-4 shrink-0 text-center">
                <i class="fa text-xs text-gray-400" :class="{'fa-chevron-right': !qualityExpanded, 'fa-chevron-down': qualityExpanded }" />
              </span>
            </button>
            <ul
              v-if="qualityExpanded && selectedEntry.victoryQualityBreakdown.length > 0"
              class="mt-1 ml-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400"
            >
              <li
                v-for="detail in selectedEntry.victoryQualityBreakdown"
                :key="detail.outcomeTypeName"
                class="flex justify-between gap-3"
              >
                <span
                  >{{ detail.outcomeTypeName }}
                  <span class="text-gray-400">({{ detail.points }} pt/rés.)</span></span
                >
                <span class="flex gap-1 items-center">
                  <span v-if="detail.wins > 0" class="text-green-600 dark:text-green-400"
                    >{{ detail.wins }}V</span
                  >
                  <span v-if="detail.losses > 0" class="text-red-600 dark:text-red-400"
                    >{{ detail.losses }}D</span
                  >
                  <span
                    class="font-medium"
                    :class="
                      detail.contribution >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    "
                  >
                    {{ detail.contribution >= 0 ? '+' : '' }}{{ detail.contribution }}
                  </span>
                </span>
              </li>
              <li
                class="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-600 pt-1 font-semibold"
              >
                <span>Total</span>
                <span
                  :class="
                    selectedEntry.victoryQuality >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  "
                >
                  {{ selectedEntry.victoryQuality >= 0 ? '+' : ''
                  }}{{ selectedEntry.victoryQuality.toFixed(1) }}
                </span>
              </li>
            </ul>
          </li>
          <li class="flex items-center gap-4">
            <span class="flex-1">Win rate</span>
            <span class="font-medium">{{ formatPercent(selectedEntry.winRate) }}</span>
            <span class="w-4 shrink-0" />
          </li>
        </ul>
      </div>
    </Popover>

    <Popover ref="qualityDetailPanel">
      <div v-if="selectedQualityEntry" class="p-3 min-w-[260px]">
        <p class="font-semibold text-sm mb-2 text-gray-800 dark:text-gray-100">
          {{ selectedQualityEntry.name }} — Qualité des résultats
        </p>
        <div
          v-if="selectedQualityEntry.victoryQualityBreakdown.length > 0"
          class="text-sm text-gray-700 dark:text-gray-300"
        >
          <div
            v-for="detail in selectedQualityEntry.victoryQualityBreakdown"
            :key="detail.outcomeTypeName"
            class="flex items-center justify-between gap-4 py-0.5"
          >
            <span class="text-gray-600 dark:text-gray-400">
              {{ detail.outcomeTypeName }}
              <span class="text-xs text-gray-400">({{ detail.points }} pt/rés.)</span>
            </span>
            <span class="flex gap-2 items-center">
              <span v-if="detail.wins > 0" class="text-green-600 dark:text-green-400"
                >{{ detail.wins }}V</span
              >
              <span v-if="detail.losses > 0" class="text-red-600 dark:text-red-400"
                >{{ detail.losses }}D</span
              >
              <span
                class="font-medium"
                :class="
                  detail.contribution >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                "
              >
                {{ detail.contribution >= 0 ? '+' : '' }}{{ detail.contribution }}
              </span>
            </span>
          </div>
          <div
            class="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2 flex justify-between font-semibold text-sm"
          >
            <span>Total</span>
            <span
              :class="
                selectedQualityEntry.victoryQuality >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              "
            >
              {{ selectedQualityEntry.victoryQuality >= 0 ? '+' : ''
              }}{{ selectedQualityEntry.victoryQuality.toFixed(1) }}
            </span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">Aucun match joué</p>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import Dialog from 'primevue/dialog'
import { useStandingsService } from '@/composables/standings.service'
import { outcomeTypeApi } from '@/composables/outcome-type.api'
import type { StandingsEntry, OutcomeType } from '@skill-arena/shared'

interface TournamentConfig {
  pointPerVictory: number
  pointPerDraw: number
  pointPerLoss: number
  maxMatchesPerPlayer: number
  maxTimesWithSamePartner: number
  maxTimesWithSameOpponent: number
  minTeamSize: number
  maxTeamSize: number
  minScore?: number | null
  maxScore?: number | null
  disciplineId?: string | null
}

interface Props {
  tournamentId: string
  allowDraw?: boolean
  scoreEnabled?: boolean
  teamMode?: 'static' | 'flex'
  standingsType?: 'official' | 'provisional'
  tournamentConfig?: TournamentConfig
}

const props = withDefaults(defineProps<Props>(), {
  allowDraw: true,
  scoreEnabled: true,
  teamMode: 'flex',
})

const emit = defineEmits<{
  (e: 'update:standingsType', value: 'official' | 'provisional'): void
}>()

const { standings, loading, error, loadOfficialStandings, loadProvisionalStandings } =
  useStandingsService()

const internalStandingsType = ref<'official' | 'provisional'>('official')
const tiebreakerPanel = ref()
const qualityDetailPanel = ref()
const selectedEntry = ref<StandingsEntry | null>(null)
const qualityExpanded = ref(false)
const selectedQualityEntry = ref<StandingsEntry | null>(null)
const infoVisible = ref(false)
const outcomeTypes = ref<OutcomeType[]>([])

watch(infoVisible, async (visible) => {
  if (visible && outcomeTypes.value.length === 0 && props.tournamentConfig?.disciplineId) {
    outcomeTypes.value = await outcomeTypeApi.list(props.tournamentConfig.disciplineId)
  }
})

const isOneVsOne = computed(
  () =>
    props.teamMode === 'flex' &&
    props.tournamentConfig?.minTeamSize === 1 &&
    props.tournamentConfig?.maxTeamSize === 1,
)
const isFlexTeam = computed(() => props.teamMode === 'flex' && !isOneVsOne.value)

const standingsType = computed({
  get: () => props.standingsType ?? internalStandingsType.value,
  set: (val) => {
    internalStandingsType.value = val
    emit('update:standingsType', val)
  },
})

const standingsTypeOptions = [
  { label: 'Officiel', value: 'official' },
  { label: 'Provisoire', value: 'provisional' },
]

function toggleTiebreakerPanel(event: Event, entry: StandingsEntry) {
  selectedEntry.value = entry
  qualityExpanded.value = false
  tiebreakerPanel.value?.toggle(event)
}

function openQualityPanel(event: MouseEvent, entry: StandingsEntry) {
  selectedQualityEntry.value = entry
  qualityDetailPanel.value?.show(event)
}

function formatRatio(ratio: number): string {
  if (!isFinite(ratio)) return '∞'
  return ratio.toFixed(2)
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

watch(standingsType, async (newType) => {
  await loadStandings(newType)
})

async function loadStandings(type: 'official' | 'provisional') {
  if (type === 'official') {
    await loadOfficialStandings(props.tournamentId)
  } else {
    await loadProvisionalStandings(props.tournamentId)
  }
}

onMounted(async () => {
  await loadStandings(standingsType.value)
})
</script>

<style scoped>
.standings-table {
  width: 100%;
}

.standings-container {
  position: relative;
  min-height: 200px;
}

.standings-fade-enter-active {
  transition: opacity 0.25s ease-in;
}

.standings-fade-leave-active {
  transition: opacity 0.2s ease-out;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.standings-fade-enter-from {
  opacity: 0;
}

.standings-fade-leave-to {
  opacity: 0;
}

.standings-fade-enter-to,
.standings-fade-leave-from {
  opacity: 1;
}
</style>
