<template>
  <DataTable
    :value="players"
    :loading="loading"
    striped-rows
    paginator
    :rows="20"
    :rows-per-page-options="[10, 20, 50]"
    responsive-layout="scroll"
    class="p-datatable-sm"
  >
    <Column header="#" style="width: 3rem">
      <template #body="{ index }">
        <span class="font-bold">{{ index + 1 }}</span>
      </template>
    </Column>

    <Column header="Joueur">
      <template #body="{ data }">
        <RouterLink
          v-if="data.player"
          :to="`/players/${data.player.id}`"
          class="font-semibold hover:underline"
        >
          {{ data.player.displayName }}
        </RouterLink>
        <span v-else>Inconnu</span>
      </template>
    </Column>

    <Column header="Rang" style="width: 6rem">
      <template #body="{ data }">
        <Tag
          :severity="tierSeverity(getPlayerRank(data.currentMmr))"
          :value="tierLabel(getPlayerRank(data.currentMmr))"
        />
      </template>
    </Column>

    <Column field="currentMmr" header="MMR" sortable style="width: 6rem">
      <template #body="{ data }">
        <span class="font-bold">{{ data.currentMmr }}</span>
      </template>
    </Column>

    <Column header="V/D" style="width: 6rem">
      <template #body="{ data }">
        <span class="text-green-600 font-medium">{{ data.wins }}</span>
        <span class="text-gray-400 mx-1">/</span>
        <span class="text-red-500 font-medium">{{ data.losses }}</span>
      </template>
    </Column>

    <Column header="Winrate" style="width: 6rem">
      <template #body="{ data }">
        <span>{{ winrate(data) }}%</span>
      </template>
    </Column>

    <Column header="Streak" style="width: 6rem">
      <template #body="{ data }">
        <span v-if="data.winStreak > 0" class="text-green-600 font-medium">
          🔥 {{ data.winStreak }}
        </span>
        <span v-else>—</span>
      </template>
    </Column>

    <Column header="Statut" style="width: 8rem">
      <template #body="{ data }">
        <Tag
          v-if="data.matchesPlayed < placementMatches"
          severity="secondary"
          :value="`Placement ${data.matchesPlayed}/${placementMatches}`"
        />
      </template>
    </Column>

    <template #empty>
      <div class="text-center py-8 text-gray-500">Aucun joueur classé pour cette saison</div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import type { ClientPlayerMmr, RankBoundaries, RankTier } from '@skill-arena/shared/types/index'

const props = defineProps<{
  players: ClientPlayerMmr[]
  boundaries: RankBoundaries | null | undefined
  placementMatches: number
  loading?: boolean
}>()

function getPlayerRank(mmr: number): RankTier {
  const b = props.boundaries
  if (!b) return 'legend'
  if (mmr > b.challengerMax) return 'challenger'
  if (mmr > b.masterMax) return 'master'
  if (mmr > b.strategistMax) return 'strategist'
  return 'legend'
}

function tierLabel(tier: RankTier) {
  const labels: Record<RankTier, string> = {
    challenger: 'Challenger',
    master: 'Master',
    strategist: 'Stratège',
    legend: 'Légende',
  }
  return labels[tier] ?? tier
}

function tierSeverity(tier: RankTier) {
  const severities: Record<RankTier, string> = {
    challenger: 'danger',
    master: 'warning',
    strategist: 'info',
    legend: 'secondary',
  }
  return severities[tier] ?? 'secondary'
}

function winrate(player: ClientPlayerMmr) {
  const total = player.wins + player.losses
  if (total === 0) return 0
  return Math.round((player.wins / total) * 100)
}
</script>
