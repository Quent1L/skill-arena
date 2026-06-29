<template>
  <div
    class="tournament-card cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 rounded-lg p-4 overflow-hidden"
    :class="modeAccentClass"
    @click="$emit('click', tournament)"
  >
    <div class="space-y-3">
      <!-- Top row: status pill -->
      <div class="flex items-center justify-between gap-2">
        <span
          class="status-pill text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
          :class="statusPillClass"
        >
          {{ statusLabel }}
        </span>
      </div>

      <!-- Body: icon + name + tags -->
      <div class="flex items-start gap-3">
        <div
          class="mode-icon-circle shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          :class="modeIconBgClass"
        >
          <i :class="[displayIcon, modeIconColorClass, 'text-base']"></i>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-bold text-white leading-tight truncate mb-1.5">
            {{ tournament.name }}
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-if="tournament.discipline"
              class="tag text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300"
            >
              <i class="fa fa-gamepad mr-1 text-gray-400"></i>{{ tournament.discipline.name }}
            </span>
            <span class="tag text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">
              {{ modeLabel }}
            </span>
          </div>
        </div>
      </div>

      <!-- Progress bar section -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400 uppercase tracking-wider font-semibold">{{ t('tournamentCard.period.label') }}</span>
          <span class="font-semibold" :class="periodLabelClass">{{ periodLabel }}</span>
        </div>
        <div class="progress-track h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            class="progress-bar h-full rounded-full transition-all duration-500"
            :class="[modeProgressClass, { 'animate-pulse': isProgressPulsing }]"
            :style="{ width: `${timeProgress}%` }"
          ></div>
        </div>
      </div>

      <!-- Bottom: date range -->
      <div class="flex items-center gap-1.5 text-xs text-gray-500 pt-1 border-t border-white/10">
        <i class="fa fa-calendar-days text-gray-600"></i>
        <span>{{ formatDate(tournament.startDate) }}</span>
        <span class="text-gray-600">→</span>
        <span>{{ formatDate(tournament.endDate) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ClientTournamentSummary } from '@skol-arena/shared/types/index'

const { t } = useI18n()

interface Props {
  tournament: ClientTournamentSummary
}

const props = defineProps<Props>()

defineEmits<{
  click: [tournament: ClientTournamentSummary]
}>()

// Status pill
const statusConfig: Record<string, { pillClass: string }> = {
  draft: {
    pillClass: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  },
  open: { pillClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  ongoing: {
    pillClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  finished: {
    pillClass: 'bg-gray-500/20 text-gray-500 border border-gray-500/30',
  },
}

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    draft: t('tournamentCard.status.draft'),
    open: t('tournamentCard.status.open'),
    ongoing: t('tournamentCard.status.ongoing'),
    finished: t('tournamentCard.status.finished'),
  }
  return labels[props.tournament.status] ?? props.tournament.status
})
const statusPillClass = computed(
  () => statusConfig[props.tournament.status]?.pillClass ?? statusConfig.draft.pillClass,
)

// Mode config
const modeConfig: Record<
  string,
  {
    icon: string
    accentClass: string
    iconColorClass: string
    iconBgClass: string
    progressClass: string
  }
> = {
  championship: {
    icon: 'fa fa-trophy',
    accentClass: 'mode-championship',
    iconColorClass: 'text-blue-400',
    iconBgClass: 'bg-blue-500/20',
    progressClass: 'bg-blue-500',
  },
  bracket: {
    icon: 'fa fa-sitemap',
    accentClass: 'mode-bracket',
    iconColorClass: 'text-gray-400',
    iconBgClass: 'bg-gray-500/20',
    progressClass: 'bg-gray-400',
  },
  ranked: {
    icon: 'fa fa-ranking-star',
    accentClass: 'mode-ranked',
    iconColorClass: 'text-amber-400',
    iconBgClass: 'bg-amber-500/20',
    progressClass: 'bg-amber-500',
  },
}

const modeLabel = computed(() => {
  const labels: Record<string, string> = {
    championship: t('tournamentCard.mode.championship'),
    bracket: t('tournamentCard.mode.bracket'),
    ranked: t('tournamentCard.mode.ranked'),
  }
  return labels[props.tournament.mode] ?? props.tournament.mode
})
const modeIcon = computed(() => modeConfig[props.tournament.mode]?.icon ?? 'fa fa-trophy')
const modeAccentClass = computed(() => modeConfig[props.tournament.mode]?.accentClass ?? '')
const modeIconColorClass = computed(
  () => modeConfig[props.tournament.mode]?.iconColorClass ?? 'text-gray-400',
)
const modeIconBgClass = computed(
  () => modeConfig[props.tournament.mode]?.iconBgClass ?? 'bg-gray-500/20',
)
const modeProgressClass = computed(
  () => modeConfig[props.tournament.mode]?.progressClass ?? 'bg-gray-400',
)

const displayIcon = computed(
  () => props.tournament.discipline?.icon || modeIcon.value,
)

// Time progress bar
const timeProgress = computed(() => {
  const { status, startDate, endDate } = props.tournament
  if (status === 'finished') return 100
  const now = Date.now()
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (status !== 'ongoing' && status !== 'open') return 0
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
})

const isProgressPulsing = computed(() => props.tournament.status === 'open')

const periodLabel = computed(() => {
  const { status, startDate, endDate } = props.tournament
  const now = Date.now()
  if (status === 'finished') return t('tournamentCard.period.finished')
  if (status === 'draft') {
    const daysUntil = Math.ceil((new Date(startDate).getTime() - now) / 86_400_000)
    if (daysUntil <= 0) return t('tournamentCard.period.soon')
    return t('tournamentCard.period.startsIn', { days: daysUntil })
  }
  if (status === 'open') {
    const daysUntil = Math.ceil((new Date(startDate).getTime() - now) / 86_400_000)
    const daysLeft = Math.ceil((new Date(endDate).getTime() - now) / 86_400_000)
    if (daysLeft <= 0) return t('tournamentCard.period.endingSoon')
    if (daysUntil <= 0) return t('tournamentCard.period.registrationsOpen')
    return t('tournamentCard.period.startsIn', { days: daysUntil })
  }
  if (status === 'ongoing') {
    const daysLeft = Math.ceil((new Date(endDate).getTime() - now) / 86_400_000)
    if (daysLeft <= 0) return t('tournamentCard.period.endingSoon')
    return t('tournamentCard.period.daysLeft', { days: daysLeft })
  }
  return '–'
})

const periodLabelClass = computed(() => {
  const { status } = props.tournament
  if (status === 'finished') return 'text-gray-500'
  if (status === 'ongoing') return modeIconColorClass.value
  return 'text-blue-400'
})

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<style scoped>
.tournament-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left-width: 3px;
  background-color: var(--color-surface-800);
}

/* Championship — blue */
.tournament-card.mode-championship {
  border-left-color: rgb(59, 130, 246);
}
.tournament-card.mode-championship:hover {
  border-color: rgba(59, 130, 246, 0.3);
  border-left-color: rgb(59, 130, 246);
  box-shadow: 0 10px 25px -5px rgb(59 130 246 / 0.2);
}

/* Bracket — gray */
.tournament-card.mode-bracket {
  border-left-color: rgb(107, 114, 128);
}
.tournament-card.mode-bracket:hover {
  border-color: rgba(107, 114, 128, 0.3);
  border-left-color: rgb(156, 163, 175);
  box-shadow: 0 10px 25px -5px rgb(107 114 128 / 0.2);
}

/* Ranked — amber */
.tournament-card.mode-ranked {
  border-left-color: rgb(245, 158, 11);
}
.tournament-card.mode-ranked:hover {
  border-color: rgba(245, 158, 11, 0.3);
  border-left-color: rgb(245, 158, 11);
  box-shadow: 0 10px 25px -5px rgb(245 158 11 / 0.25);
}
</style>
