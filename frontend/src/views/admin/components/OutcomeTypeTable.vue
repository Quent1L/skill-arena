<template>
  <div class="mb-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Types de résultat</h2>
      <Button
        label="Ajouter un type"
        icon="fa fa-plus"
        size="small"
        @click="emit('add-outcome-type')"
      />
    </div>

    <DataTable
      v-model:expandedRows="expandedRows"
      :value="outcomeTypes"
      :loading="loading"
      dataKey="id"
      striped-rows
      class="p-datatable-sm"
      @rowExpand="onRowExpand"
      @rowCollapse="onRowCollapse"
    >
      <Column expander style="width: 5rem" />

      <Column field="name" header="Nom" sortable>
        <template #body="{ data }">
          <span class="font-medium" :class="{ 'opacity-60': data.archivedAt }">{{ data.name }}</span>
          <Tag v-if="data.isDefault" value="Par défaut" severity="success" class="ml-2" />
          <Tag v-if="data.archivedAt" value="Archivé" severity="secondary" class="ml-2" />
        </template>
      </Column>

      <Column field="points" header="Pts / résultat" style="width: 10rem">
        <template #body="{ data }">
          <span class="text-gray-700 dark:text-gray-300">{{ data.points }}</span>
        </template>
      </Column>
      <Column field="mmrMultiplier" header="MMR multiplier"></Column>

      <Column header="Actions" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2">
            <Button
              icon="fa fa-edit"
              size="small"
              text
              rounded
              @click="emit('edit-outcome-type', data)"
              v-tooltip.top="'Modifier'"
            />
            <Button
              v-if="data.archivedAt"
              icon="fa fa-rotate-left"
              size="small"
              text
              rounded
              @click="emit('restore-outcome-type', data)"
              v-tooltip.top="'Restaurer'"
            />
            <Button
              v-else
              icon="fa fa-trash"
              size="small"
              severity="danger"
              text
              rounded
              @click="emit('delete-outcome-type', data)"
              v-tooltip.top="'Supprimer'"
            />
          </div>
        </template>
      </Column>

      <template #expansion="slotProps">
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <h5 class="text-lg font-semibold">Raisons pour "{{ slotProps.data.name }}"</h5>
            <Button
              label="Ajouter une raison"
              icon="fa fa-plus"
              size="small"
              @click="emit('add-outcome-reason', slotProps.data)"
            />
          </div>

          <DataTable
            :value="getOutcomeReasonsForType(slotProps.data.id)"
            :loading="loading"
            striped-rows
            class="p-datatable-sm"
          >
            <Column field="name" header="Nom" sortable>
              <template #body="{ data }">
                <span>{{ data.name }}</span>
              </template>
            </Column>

            <Column header="Actions" style="width: 10rem">
              <template #body="{ data }">
                <div class="flex gap-2">
                  <Button
                    icon="fa fa-edit"
                    size="small"
                    text
                    rounded
                    @click="emit('edit-outcome-reason', slotProps.data, data)"
                    v-tooltip.top="'Modifier'"
                  />
                  <Button
                    icon="fa fa-trash"
                    size="small"
                    severity="danger"
                    text
                    rounded
                    @click="emit('delete-outcome-reason', data)"
                    v-tooltip.top="'Supprimer'"
                  />
                </div>
              </template>
            </Column>

            <template #empty>
              <div class="text-center py-2">
                <p class="text-gray-500 text-sm">Aucune raison de résultat</p>
              </div>
            </template>
          </DataTable>
        </div>
      </template>

      <template #empty>
        <div class="text-center py-4">
          <p class="text-gray-500">Aucun type de résultat</p>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { OutcomeType } from '@skol-arena/shared/types/outcome-type'
import type { OutcomeReason } from '@skol-arena/shared/types/outcome-reason'

interface Props {
  outcomeTypes: OutcomeType[]
  outcomeReasons: OutcomeReason[]
  loading: boolean
  loadOutcomeReasons: (outcomeTypeId: string) => Promise<void>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-outcome-type': []
  'edit-outcome-type': [outcomeType: OutcomeType]
  'delete-outcome-type': [outcomeType: OutcomeType]
  'restore-outcome-type': [outcomeType: OutcomeType]
  'add-outcome-reason': [outcomeType: OutcomeType]
  'edit-outcome-reason': [outcomeType: OutcomeType, outcomeReason: OutcomeReason]
  'delete-outcome-reason': [outcomeReason: OutcomeReason]
}>()

const expandedRows = ref<Record<string, boolean>>({})
const loadedOutcomeTypeIds = ref<Set<string>>(new Set())

// Computed that derives reasons by type from the props (updates automatically)
const outcomeReasonsByType = computed(() => {
  const map = new Map<string, OutcomeReason[]>()
  props.outcomeReasons.forEach((reason) => {
    if (!map.has(reason.outcomeTypeId)) {
      map.set(reason.outcomeTypeId, [])
    }
    map.get(reason.outcomeTypeId)!.push(reason)
  })
  return map
})

function onRowExpand(event: { data: OutcomeType }) {
  const outcomeTypeId = event.data.id
  // Load reasons only if not already loaded
  if (!loadedOutcomeTypeIds.value.has(outcomeTypeId)) {
    loadOutcomeReasonsForType(outcomeTypeId)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onRowCollapse(_event: { data: OutcomeType }) {
  // Optional: clean up data if needed
}

async function loadOutcomeReasonsForType(outcomeTypeId: string) {
  try {
    await props.loadOutcomeReasons(outcomeTypeId)
    loadedOutcomeTypeIds.value.add(outcomeTypeId)
  } catch (err) {
    console.error('Erreur lors du chargement des raisons:', err)
  }
}

function getOutcomeReasonsForType(outcomeTypeId: string): OutcomeReason[] {
  return outcomeReasonsByType.value.get(outcomeTypeId) || []
}

// Expose expandedRows to allow cleanup when a type is deleted
defineExpose({
  expandedRows,
})
</script>
