<template>
  <DataTable
    :value="history"
    :loading="loading"
    striped-rows
    paginator
    :rows="20"
    responsive-layout="scroll"
    class="p-datatable-sm"
  >
    <Column header="Date">
      <template #body="{ data }">
        {{ formatDate(data.match?.playedAt) }}
      </template>
    </Column>

    <Column header="MMR avant" style="width: 7rem">
      <template #body="{ data }">
        <span>{{ data.mmrBefore }}</span>
      </template>
    </Column>

    <Column header="Delta" style="width: 6rem">
      <template #body="{ data }">
        <span :class="deltaClass(data.mmrDelta)" class="font-bold">
          {{ data.mmrDelta > 0 ? '+' : '' }}{{ data.mmrDelta }}
        </span>
      </template>
    </Column>

    <Column header="MMR après" style="width: 7rem">
      <template #body="{ data }">
        <span class="font-semibold">{{ data.mmrAfter }}</span>
      </template>
    </Column>

    <Column header="MMR adversaire moyen" style="width: 10rem">
      <template #body="{ data }">
        {{ data.opponentAvgMmr }}
      </template>
    </Column>

    <Column header="Placement" style="width: 6rem">
      <template #body="{ data }">
        <Tag v-if="data.isPlacement" severity="secondary" value="Placement" />
      </template>
    </Column>

    <Column header="">
      <template #body="{ data }">
        <RouterLink
          v-if="data.matchId"
          :to="`/matches/${data.matchId}`"
          class="text-blue-600 hover:underline text-sm"
        >
          Voir le match
        </RouterLink>
      </template>
    </Column>

    <template #empty>
      <div class="text-center py-8 text-gray-500">Aucun match dans l'historique</div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import type { ClientMmrHistoryEntry } from '@skill-arena/shared/types/index'

defineProps<{
  history: ClientMmrHistoryEntry[]
  loading?: boolean
}>()

function formatDate(date: Date | string | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deltaClass(delta: number) {
  return delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-500'
}
</script>
