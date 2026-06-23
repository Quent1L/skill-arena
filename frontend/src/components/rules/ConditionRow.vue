<template>
  <div class="flex flex-wrap items-center gap-2 bg-surface-100 dark:bg-surface-800 px-2 py-2 rounded">
    <i class="fa fa-grip-vertical text-surface-400 cursor-grab"></i>

    <Select
      v-model="node.fact"
      :options="facts"
      option-label="label"
      option-value="key"
      placeholder="Variable"
      filter
      class="w-52"
      @change="onFactChange"
    />

    <Select
      v-model="node.operator"
      :options="operatorOptions"
      option-label="label"
      option-value="value"
      placeholder="Opérateur"
      class="w-44"
    />

    <template v-if="selectedFact">
      <Select
        v-if="selectedFact.type === 'boolean'"
        v-model="node.value"
        :options="booleanOptions"
        option-label="label"
        option-value="value"
        class="w-32"
      />
      <Select
        v-else-if="isPlayerFact && !isListOperator"
        v-model="node.value"
        :options="players"
        option-label="displayName"
        option-value="id"
        placeholder="Joueur"
        filter
        class="w-56"
      />
      <MultiSelect
        v-else-if="isPlayerFact && isListOperator"
        v-model="playerListValue"
        :options="players"
        option-label="displayName"
        option-value="id"
        placeholder="Joueurs"
        filter
        display="chip"
        class="w-72"
      />
      <DatePicker
        v-else-if="isTimeFact && !isListOperator"
        v-model="timeValue"
        time-only
        hour-format="24"
        class="w-32"
      />
      <DatePicker
        v-else-if="isDateFact && !isListOperator"
        v-model="dateValue"
        date-format="yy-mm-dd"
        class="w-40"
      />
      <Select
        v-else-if="isDisciplineFact && !isListOperator"
        v-model="node.value"
        :options="disciplines"
        option-label="name"
        option-value="id"
        placeholder="Discipline"
        filter
        class="w-52"
      />
      <MultiSelect
        v-else-if="isDisciplineFact && isListOperator"
        v-model="playerListValue"
        :options="disciplines"
        option-label="name"
        option-value="id"
        placeholder="Disciplines"
        display="chip"
        class="w-72"
      />
      <Select
        v-else-if="isSiteFact && !isListOperator"
        v-model="node.value"
        :options="organisations"
        option-label="name"
        option-value="id"
        placeholder="Organisation"
        filter
        class="w-52"
      />
      <MultiSelect
        v-else-if="isSiteFact && isListOperator"
        v-model="playerListValue"
        :options="organisations"
        option-label="name"
        option-value="id"
        placeholder="Organisations"
        display="chip"
        class="w-72"
      />
      <Select
        v-else-if="isWeekdayFact && !isListOperator"
        v-model="node.value"
        :options="WEEKDAY_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Jour"
        class="w-40"
      />
      <MultiSelect
        v-else-if="isWeekdayFact && isListOperator"
        v-model="weekdayListValue"
        :options="WEEKDAY_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Jours"
        display="chip"
        class="w-64"
      />
      <InputNumber
        v-else-if="selectedFact.type === 'number' && !isListOperator"
        :model-value="node.value as number"
        class="w-32"
        @update:model-value="node.value = $event"
      />
      <InputText
        v-else
        :model-value="stringValue"
        :placeholder="isListOperator ? 'valeurs séparées par des virgules' : 'valeur'"
        class="w-52"
        @update:model-value="onTextValue"
      />
    </template>

    <Button icon="fa fa-trash" size="small" text rounded severity="danger" @click="$emit('remove')" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type { BuilderNode, PlayerOption } from './condition-tree'
import type { CatalogFact } from '@/composables/rules/rules.api'
import type { Discipline, OrganizationWithMemberCount } from '@skill-arena/shared/types/index'

const node = defineModel<Extract<BuilderNode, { kind: 'leaf' }>>({ required: true })
const props = defineProps<{ facts: CatalogFact[]; players: PlayerOption[] }>()
defineEmits<{ remove: [] }>()

const disciplines = inject<Ref<Discipline[]>>('disciplines', ref([]))
const organisations = inject<Ref<OrganizationWithMemberCount[]>>('organisations', ref([]))

const OPERATOR_LABELS: Record<string, string> = {
  equal: '=',
  notEqual: '≠',
  greaterThan: '>',
  greaterThanInclusive: '≥',
  lessThan: '<',
  lessThanInclusive: '≤',
  in: 'dans la liste',
  notIn: 'pas dans la liste',
  contains: 'contient',
  doesNotContain: 'ne contient pas',
}

const selectedFact = computed(() => props.facts.find((f) => f.key === node.value.fact))

const operatorOptions = computed(() =>
  (selectedFact.value?.operators ?? []).map((op) => ({ label: OPERATOR_LABELS[op] ?? op, value: op })),
)

const isListOperator = computed(() => node.value.operator === 'in' || node.value.operator === 'notIn')

const isPlayerFact = computed(() => selectedFact.value?.ref === 'player')

const isTimeFact = computed(() => selectedFact.value?.ref === 'time')

const isDateFact = computed(() => selectedFact.value?.type === 'date')

const isDisciplineFact = computed(() => selectedFact.value?.ref === 'discipline')
const isSiteFact = computed(() => selectedFact.value?.ref === 'site')
const isWeekdayFact = computed(() => selectedFact.value?.ref === 'weekday')

const WEEKDAY_OPTIONS = [
  { label: 'Lundi', value: 1 },
  { label: 'Mardi', value: 2 },
  { label: 'Mercredi', value: 3 },
  { label: 'Jeudi', value: 4 },
  { label: 'Vendredi', value: 5 },
  { label: 'Samedi', value: 6 },
  { label: 'Dimanche', value: 7 },
]

const weekdayListValue = computed<number[]>({
  get: () => (Array.isArray(node.value.value) ? (node.value.value as number[]) : []),
  set: (val) => { node.value.value = val },
})

const dateValue = computed<Date | null>({
  get: () => {
    const v = node.value.value
    if (v instanceof Date) return v
    if (typeof v !== 'string' || !v) return null
    const [y, mo, d] = v.split('-').map(Number)
    return new Date(y, mo - 1, d)
  },
  set: (d) => {
    if (!d) { node.value.value = ''; return }
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    node.value.value = `${y}-${m}-${day}`
  },
})

/** Minute-of-day number <-> Date for the time picker. */
const timeValue = computed<Date | null>({
  get: () => {
    const min = node.value.value
    if (typeof min !== 'number') return null
    const d = new Date()
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    return d
  },
  set: (d) => {
    node.value.value = d ? d.getHours() * 60 + d.getMinutes() : ''
  },
})

const playerListValue = computed<string[]>({
  get: () => (Array.isArray(node.value.value) ? (node.value.value as string[]) : []),
  set: (val) => {
    node.value.value = val
  },
})

const booleanOptions = [
  { label: 'Vrai', value: true },
  { label: 'Faux', value: false },
]

const stringValue = computed(() =>
  Array.isArray(node.value.value) ? (node.value.value as unknown[]).join(', ') : String(node.value.value ?? ''),
)

function onFactChange() {
  node.value.operator = ''
  node.value.value = selectedFact.value?.type === 'boolean' ? true : ''
}

function onTextValue(val: string | undefined) {
  const value = val ?? ''
  node.value.value = isListOperator.value ? value.split(',').map((v) => v.trim()).filter(Boolean) : value
}
</script>
