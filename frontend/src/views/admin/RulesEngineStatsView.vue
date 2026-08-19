<template>
  <div class="rules-engine-stats p-4">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-3">
        <Button icon="fa fa-arrow-left" text rounded @click="router.push('/admin/rules-engine')" />
        <h1 class="text-2xl font-bold">{{ currentRule?.name ?? t('rulesEngineStats.title') }}</h1>
        <Tag v-if="currentRule" :severity="currentRule.type === 'badge' ? 'warn' : 'info'" :value="typeLabel" />
      </div>
      <Select
        v-model="days"
        :options="rangeOptions"
        option-label="label"
        option-value="value"
        class="w-44"
        @change="reload"
      />
    </div>

    <Message v-if="error" severity="error" :closable="true">{{ error }}</Message>

    <div v-if="totals" class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div v-for="kpi in kpis" :key="kpi.label" class="kpi">
        <p class="text-xs uppercase tracking-wide text-surface-500">{{ kpi.label }}</p>
        <p class="text-2xl font-bold" :class="kpi.tone">{{ kpi.value }}</p>
        <p v-if="kpi.hint" class="text-xs text-surface-500 mt-1">{{ kpi.hint }}</p>
      </div>
    </div>

    <Message v-if="totals && totals.fired === 0" severity="info" :closable="false" class="mb-4">
      {{ t('rulesEngineStats.neverFired') }}
    </Message>

    <Message v-else-if="dropRate >= 50" severity="warn" :closable="false" class="mb-4">
      {{ t('rulesEngineStats.mostlyUnreadWarning', { percent: dropRate }) }}
    </Message>

    <!-- Timeline: bars normalised against the busiest day in the window, so a rule
         that fires twice a week is still readable next to one that fires hourly. -->
    <div v-if="detail?.timeline.length" class="panel mb-6">
      <h2 class="text-lg font-semibold mb-3">{{ t('rulesEngineStats.timelineTitle') }}</h2>
      <div class="flex items-end gap-1 h-32 overflow-x-auto">
        <div
          v-for="day in detail.timeline"
          :key="day.day"
          class="flex-1 min-w-2 flex flex-col justify-end"
          v-tooltip.top="dayTooltip(day)"
        >
          <div
            class="bg-primary-500 rounded-t"
            :style="{ height: `${barHeight(day.fired)}%` }"
          />
        </div>
      </div>
      <p class="text-xs text-surface-500 mt-2">
        {{ t('rulesEngineStats.timelineFootnote', { days }) }}
      </p>
    </div>

    <div v-if="detail?.variants.length" class="panel mb-6">
      <h2 class="text-lg font-semibold mb-3">{{ t('rulesEngineStats.variantsTitle') }}</h2>
      <DataTable :value="detail.variants" class="p-datatable-sm" striped-rows>
        <Column :header="t('rulesEngineStats.colVariant')" style="width: 6rem">
          <template #body="{ data }">
            <span v-if="data.current">#{{ data.position + 1 }}</span>
            <Tag v-else severity="secondary" :value="t('rulesEngineStats.variantRetired')" />
          </template>
        </Column>
        <Column field="text" :header="t('rulesEngineStats.colText')">
          <template #body="{ data }">
            <span v-if="data.text" :class="{ 'text-surface-500': !data.current }">{{ data.text }}</span>
            <span v-else class="text-surface-500 italic">{{ t('rulesEngineStats.variantUnrecorded') }}</span>
          </template>
        </Column>
        <Column field="fired" :header="t('rulesEngineStats.colSent')" style="width: 8rem" sortable />
        <Column field="seen" :header="t('rulesEngineStats.colRead')" style="width: 8rem" sortable />
      </DataTable>
      <!-- An edited variant leaves its history behind under the old wording rather
           than folding it into the new one, so the two counts stay honest. -->
      <p v-if="hasRetiredVariants" class="text-xs text-surface-500 mt-2">
        {{ t('rulesEngineStats.variantsFootnote') }}
      </p>
    </div>

    <div class="panel">
      <h2 class="text-lg font-semibold mb-3">{{ t('rulesEngineStats.recipientsTitle') }}</h2>
      <DataTable :value="detail?.recipients ?? []" :loading="loading" class="p-datatable-sm" striped-rows>
        <Column field="playerName" :header="t('rulesEngineStats.colPlayer')" />
        <Column field="createdAt" :header="t('rulesEngineStats.colDate')">
          <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
        </Column>
        <Column field="result" :header="t('rulesEngineStats.colResult')">
          <template #body="{ data }">
            <Tag :severity="resultSeverity(data.result)" :value="t(`rulesEngineStats.result.${data.result}`)" />
          </template>
        </Column>
        <Column :header="t('rulesEngineStats.colFate')">
          <template #body="{ data }">
            <Tag :severity="fateSeverity(data)" :value="fateLabel(data)" />
          </template>
        </Column>
        <Column field="message" :header="t('rulesEngineStats.colMessage')">
          <template #body="{ data }">
            <span class="text-sm">{{ data.message ?? '—' }}</span>
          </template>
        </Column>
        <Column :header="t('common.actions')" style="width: 5rem">
          <template #body="{ data }">
            <Button
              v-if="data.matchId"
              icon="fa fa-arrow-up-right-from-square"
              size="small"
              text
              rounded
              @click="router.push(`/matches/${data.matchId}`)"
              v-tooltip.top="t('rulesEngineStats.openMatch')"
            />
          </template>
        </Column>
        <template #empty>
          <p class="text-center text-surface-500 py-6">{{ t('rulesEngineStats.noRecipients') }}</p>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRulesService } from '@/composables/rules/rules.service'
import type { ClientRuleFiringRecipient, RuleFiringDayStat } from '@skol-arena/shared/types/index'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { currentRule, loadRuleById, firingDetail, loadFiringDetail, loading, error } = useRulesService()

const ruleId = route.params.id as string
const days = ref(30)

const rangeOptions = [
  { label: t('rulesEngineStats.range7'), value: 7 },
  { label: t('rulesEngineStats.range30'), value: 30 },
  { label: t('rulesEngineStats.range90'), value: 90 },
]

const detail = computed(() => firingDetail.value)
const totals = computed(() => firingDetail.value?.totals ?? null)
const typeLabel = computed(() =>
  currentRule.value?.type === 'badge' ? t('rulesEngineList.typeBadge') : t('rulesEngineList.typeMessage'),
)

/** Share of delivered messages that were consumed by the recap, which shows none. */
const dropRate = computed(() => {
  const stats = totals.value
  if (!stats || stats.delivered === 0) return 0
  return Math.round((stats.recap / stats.delivered) * 100)
})

const kpis = computed(() => {
  const stats = totals.value
  if (!stats) return []
  return [
    { label: t('rulesEngineStats.kpiFired'), value: stats.fired, tone: '', hint: '' },
    {
      label: t('rulesEngineStats.kpiPlayers'),
      value: stats.distinctPlayers,
      tone: '',
      hint: '',
    },
    {
      label: t('rulesEngineStats.kpiDelivered'),
      value: stats.delivered,
      tone: '',
      hint: t('rulesEngineStats.kpiNeverDeliveredHint', { count: stats.neverDelivered }),
    },
    {
      label: t('rulesEngineStats.kpiSeen'),
      value: stats.seen,
      tone: 'text-green-500',
      hint: '',
    },
    {
      label: t('rulesEngineStats.kpiRecap'),
      value: stats.recap,
      tone: stats.recap > 0 ? 'text-orange-500' : '',
      hint: t('rulesEngineStats.kpiRecapHint'),
    },
  ]
})

const hasRetiredVariants = computed(() => (detail.value?.variants ?? []).some((v) => !v.current))

const peak = computed(() => Math.max(1, ...(detail.value?.timeline ?? []).map((d) => d.fired)))

function barHeight(fired: number) {
  return Math.max(4, Math.round((fired / peak.value) * 100))
}

function dayTooltip(day: RuleFiringDayStat) {
  return t('rulesEngineStats.dayTooltip', { day: day.day, fired: day.fired, seen: day.seen, recap: day.recap })
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString('fr-FR')
}

function resultSeverity(result: string) {
  if (result === 'selected' || result === 'awarded') return 'success'
  return 'secondary'
}

/**
 * What became of this firing. `superseded` never had a chance to be delivered, so
 * it reads as its own outcome rather than as an undelivered message.
 */
function fateLabel(row: ClientRuleFiringRecipient) {
  if (row.result === 'superseded') return t('rulesEngineStats.fate.superseded')
  if (row.result === 'already_held') return t('rulesEngineStats.fate.alreadyHeld')
  if (!row.deliveredAt) return t('rulesEngineStats.fate.notDelivered')
  if (row.seenSurface === 'recap') return t('rulesEngineStats.fate.recap')
  if (row.seenSurface) return t('rulesEngineStats.fate.seen')
  return t('rulesEngineStats.fate.pending')
}

function fateSeverity(row: ClientRuleFiringRecipient) {
  if (row.seenSurface === 'recap') return 'warn'
  if (row.seenSurface) return 'success'
  if (!row.deliveredAt) return 'danger'
  return 'secondary'
}

function reload() {
  loadFiringDetail(ruleId, days.value)
}

onMounted(() => {
  loadRuleById(ruleId)
  reload()
})
</script>

<style scoped>
.rules-engine-stats {
  max-width: 1400px;
  margin: 0 auto;
}

.kpi,
.panel {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.75rem;
  padding: 1rem;
}
</style>
