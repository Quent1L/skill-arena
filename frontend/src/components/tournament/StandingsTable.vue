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
     
    </div>

    <Message v-if="error" severity="error" class="mb-4">
      {{ error }}
    </Message>

    <div v-if="standings.length === 0 && !loading" class="text-center py-8 text-gray-500 dark:text-gray-400">
      Aucun classement disponible pour le moment
    </div>

    <div class="standings-container">
      <Transition name="standings-fade" mode="out-in">
        <div
          v-if="standings.length > 0"
          :key="`standings-${standingsType}`"
          class="relative"
        >
          <DataTable
            :value="standings"
            :paginator="standings.length > 10"
            :rows="20"
            :rowsPerPageOptions="[10, 20, 50]"
            class="p-datatable-sm"
            striped-rows
            :loading="loading"
          >
      <Column field="rank" header="#" style="width: 4rem">
        <template #body="{ index }">
          <div class="flex items-center justify-center">
            <i
              v-if="index === 0"
              class="fa fa-trophy text-yellow-500 "
              title="Premier"
            ></i>
            <i
              v-if="index === 1"
              class="fa fa-medal text-gray-400 "
              title="Deuxième"
            ></i>
            <i
              v-if="index === 2"
              class="fa fa-medal text-orange-600"
              title="Troisième"
            ></i>
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
          <div class="font-medium text-gray-900 dark:text-white">
            {{ data.name }}
          </div>
        </template>
      </Column>

      <Column field="points" header="Pts" >
        <template #body="{ data }">
          <div class="font-semibold text-blue-600 dark:text-blue-400">
            {{ data.points }}
          </div>
        </template>
      </Column>

      <Column field="matchesPlayed" header="MJ" >
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

      <Column 
        v-if="allowDraw"
        field="draws" 
        header="N" 
      >
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

      <Column field="scored" header="BP">
        <template #body="{ data }">
          {{ data.scored }}
        </template>
      </Column>

      <Column field="conceded" header="BC">
        <template #body="{ data }">
          {{ data.conceded }}
        </template>
      </Column>

      <Column field="scoreDiff" header="Diff">
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
          </DataTable>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { useStandingsService } from '@/composables/standings.service'

interface Props {
  tournamentId: string
  allowDraw?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  allowDraw: true,
})

const { standings, loading, error, loadOfficialStandings, loadProvisionalStandings } =
  useStandingsService()

const standingsType = ref<'official' | 'provisional'>('official')

const standingsTypeOptions = [
  { label: 'Officiel', value: 'official' },
  { label: 'Provisoire', value: 'provisional' },
]

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

/* Transition pour le changement de classement */
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

