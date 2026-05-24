<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6"
  >
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div
        class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0"
      >
        <i class="fa fa-chart-line text-violet-600 dark:text-violet-400 text-sm sm:text-base" />
      </div>
      <div>
        <div class="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
          Comment fonctionne le MMR ?
        </div>
        <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Système de classement par points
        </div>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="space-y-2">
      <Skeleton height="2.5rem" class="rounded-lg" />
      <Skeleton height="2.5rem" class="rounded-lg" />
      <Skeleton height="2.5rem" class="rounded-lg" />
    </div>

    <!-- Content -->
    <div v-else class="space-y-2">
      <!-- MMR de départ -->
      <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
        <i class="fa fa-star text-violet-500 mt-0.5 w-4 shrink-0 text-sm" />
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300 text-sm">MMR de départ</span>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Vous commencez à
            <span class="font-semibold text-gray-700 dark:text-gray-300"
              >{{ rankedConfig?.baseMmr ?? '—' }} points</span
            >.
          </p>
        </div>
      </div>

      <!-- Matchs de placement -->
      <div
        v-if="(rankedConfig?.placementMatches ?? 0) > 0"
        class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg"
      >
        <i class="fa fa-flag-checkered text-violet-500 mt-0.5 w-4 shrink-0 text-sm" />
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300 text-sm"
            >Matchs de placement</span
          >
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Vos
            <span class="font-semibold text-gray-700 dark:text-gray-300"
              >{{ rankedConfig?.placementMatches ?? '—' }} premiers matchs</span
            >
            servent à calibrer votre niveau — les gains et pertes sont doublés.
          </p>
        </div>
      </div>

      <!-- Gain / Perte -->
      <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
        <i class="fa fa-arrows-up-down text-violet-500 mt-0.5 w-4 shrink-0 text-sm" />
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300 text-sm">Gain / Perte</span>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Chaque résultat modifie votre score en fonction de l'écart de niveau avec vos
            adversaires.
          </p>
        </div>
      </div>

      <!-- Facteur adversaire -->
      <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
        <i class="fa fa-scale-balanced text-violet-500 mt-0.5 w-4 shrink-0 text-sm" />
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300 text-sm"
            >Facteur adversaire</span
          >
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Battre un joueur plus fort rapporte plus. Perdre contre un joueur plus faible coûte
            plus.
          </p>
        </div>
      </div>

      <!-- Répartition en équipe -->
      <div
        v-if="hasTeamMode"
        class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg"
      >
        <i class="fa fa-users text-violet-500 mt-0.5 w-4 shrink-0 text-sm" />
        <div>
          <span class="font-medium text-gray-700 dark:text-gray-300 text-sm">
            Répartition en équipe —
            <span class="text-violet-600 dark:text-violet-400">{{ teamModeLabel }}</span>
          </span>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ teamModeDescription }}</p>
        </div>
      </div>

      <!-- Accordéon formules -->
      <details
        class="group mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <summary
          class="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 dark:bg-gray-700/40 select-none hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 list-none"
        >
          <span>Voir le détail du calcul</span>
          <i
            class="fa fa-chevron-down text-gray-400 text-xs transition-transform group-open:rotate-180"
          />
        </summary>

        <div class="px-4 py-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div class="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
            <p class="font-medium text-gray-700 dark:text-gray-300 mb-1">Score attendu</p>
            <p class="text-xs leading-relaxed">
              Avant chaque match, le système estime votre probabilité de victoire à partir de
              l'écart de MMR entre vous et vos adversaires. Si les deux camps sont à égalité, la
              probabilité est de 50 %. Un écart de 400 points la fait passer à environ 24 % pour le
              camp le plus faible.
            </p>
          </div>

          <div class="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
            <p class="font-medium text-gray-700 dark:text-gray-300 mb-1">Gain ou perte de base</p>
            <p class="text-xs leading-relaxed">
              Le résultat réel (victoire, nul ou défaite) est comparé au score attendu. La
              différence est multipliée par un coefficient de sensibilité
              <span class="font-semibold text-gray-700 dark:text-gray-300"
                >({{ rankedConfig?.kFactor ?? '?' }})</span
              >
              qui détermine l'amplitude maximale de variation.
            </p>
          </div>

          <div
            v-if="(rankedConfig?.placementMatches ?? 0) > 0"
            class="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3"
          >
            <p class="font-medium text-gray-700 dark:text-gray-300 mb-1">Matchs de placement</p>
            <p class="text-xs leading-relaxed">
              Pendant vos
              <span class="font-semibold text-gray-700 dark:text-gray-300"
                >{{ rankedConfig?.placementMatches ?? '?' }} premiers matchs</span
              >, le coefficient de sensibilité est doublé. Votre MMR évolue donc deux fois plus vite
              pour rejoindre rapidement votre vrai niveau.
            </p>
          </div>

          <div v-if="hasTeamMode" class="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
            <p class="font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ajustement individuel en équipe
            </p>
            <p class="text-xs leading-relaxed">{{ teamModeDetailDescription }}</p>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { rankedApi } from '@/composables/ranked/ranked.api'
import type { RankedSeason } from '@/composables/ranked/ranked.api'

type SeasonWithFullDiscipline = RankedSeason & {
  discipline?: { id: string; name: string; teamInteractionMode?: string | null } | null
}

const props = defineProps<{ tournamentId: string }>()

const loading = ref(true)
const rankedConfig = ref<{ baseMmr: number; kFactor: number; placementMatches: number } | null>(
  null,
)
const teamInteractionMode = ref<string | null>(null)

onMounted(async () => {
  try {
    const season = (await rankedApi.getSeasonById(props.tournamentId)) as SeasonWithFullDiscipline
    rankedConfig.value = season.rankedConfig ?? null
    teamInteractionMode.value = season.discipline?.teamInteractionMode ?? null
  } finally {
    loading.value = false
  }
})

const hasTeamMode = computed(() => !!teamInteractionMode.value)

const teamModeLabel = computed(() => {
  const labels: Record<string, string> = {
    INDIVIDUAL: 'Individuel',
    SHARED_RESOURCE: 'Ressource partagée',
    COLLABORATIVE: 'Collaboratif',
  }
  return labels[teamInteractionMode.value ?? ''] ?? ''
})

const teamModeDescription = computed(() => {
  const descs: Record<string, string> = {
    INDIVIDUAL:
      "Chaque joueur est évalué selon l'écart entre son propre MMR et celui de ses adversaires.",
    SHARED_RESOURCE:
      'Battre une équipe plus forte rapporte plus à chaque membre ; perdre contre une équipe plus faible coûte plus.',
    COLLABORATIVE:
      "Tous les membres de l'équipe reçoivent le même gain ou la même perte de points.",
  }
  return descs[teamInteractionMode.value ?? ''] ?? ''
})

const teamModeDetailDescription = computed(() => {
  const descs: Record<string, string> = {
    INDIVIDUAL:
      'Le gain ou la perte calculé est ajusté pour chaque joueur en fonction du ratio entre son MMR personnel et le MMR moyen des adversaires. Un joueur plus fort que ses adversaires gagne moins en cas de victoire et perd plus en cas de défaite.',
    SHARED_RESOURCE:
      "La distribution est inversée par rapport au mode individuel : les membres dont le MMR est proche de celui des adversaires bénéficient d'un ajustement plus équilibré. Affronter une équipe bien au-dessus de votre niveau amplifie les gains en cas de victoire.",
    COLLABORATIVE:
      "Tous les membres de l'équipe reçoivent exactement le même delta de MMR, calculé à partir du MMR moyen de l'équipe face au MMR moyen de l'équipe adverse.",
  }
  return descs[teamInteractionMode.value ?? ''] ?? ''
})
</script>
