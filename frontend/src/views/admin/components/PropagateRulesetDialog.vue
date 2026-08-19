<template>
  <Dialog
    :visible="visible"
    :header="t('propagateRuleset.header')"
    :modal="true"
    :style="{ width: '640px' }"
    @update:visible="(val) => emit('update:visible', val)"
  >
    <div v-if="loading" class="py-6 text-center">
      <i class="fa fa-spinner fa-spin text-2xl" />
    </div>

    <div v-else-if="competitions.length === 0" class="py-4">
      <p class="text-gray-500">{{ t('propagateRuleset.emptyState') }}</p>
    </div>

    <div v-else>
      <Message severity="warn" :closable="false" class="mb-4">
        {{ t('propagateRuleset.warning') }}
      </Message>

      <DataTable
        v-model:selection="selected"
        :value="competitions"
        data-key="id"
        striped-rows
        class="p-datatable-sm"
      >
        <Column selection-mode="multiple" header-style="width: 3rem" />

        <Column field="name" :header="t('common.name')">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ data.name }}</span>
              <Tag
                v-if="!data.hasDrift"
                severity="secondary"
                :value="t('propagateRuleset.upToDateTag')"
              />
            </div>
          </template>
        </Column>

        <Column field="status" :header="t('propagateRuleset.statusColumn')" style="width: 8rem" />

        <Column :header="t('propagateRuleset.matchesColumn')" style="width: 10rem">
          <template #body="{ data }">
            <span v-if="data.matchCount === 0" class="text-gray-500">
              {{ t('propagateRuleset.noMatches') }}
            </span>
            <span v-else>
              {{ t('propagateRuleset.matchesEntered', { count: data.matchCount }) }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>

    <template #footer>
      <Button :label="t('common.cancel')" icon="pi pi-times" text @click="close" />
      <Button
        :label="t('propagateRuleset.apply')"
        icon="fa fa-arrows-rotate"
        :disabled="selected.length === 0 || submitting"
        :loading="submitting"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import type { ImpactedCompetition } from '@skol-arena/shared/types/index'

interface Props {
  visible: boolean
  disciplineId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  propagate: [tournamentIds: string[]]
  load: [disciplineId: string]
}>()

const { t } = useI18n()

const competitions = ref<ImpactedCompetition[]>([])
const selected = ref<ImpactedCompetition[]>([])
const loading = ref(false)
const submitting = ref(false)

/**
 * Competitions that have already drifted are preselected: they are the ones the
 * admin just caused by saving the discipline. An up-to-date one is listed but
 * left unchecked, since propagating to it would only cost a recalculation.
 */
function setCompetitions(rows: ImpactedCompetition[]) {
  competitions.value = rows
  selected.value = rows.filter((row) => row.hasDrift)
  loading.value = false
}

function setLoading() {
  loading.value = true
  competitions.value = []
  selected.value = []
}

function close() {
  emit('update:visible', false)
}

function submit() {
  submitting.value = true
  emit(
    'propagate',
    selected.value.map((row) => row.id),
  )
}

function setSubmitted() {
  submitting.value = false
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible && props.disciplineId) {
      setLoading()
      emit('load', props.disciplineId)
    }
  },
)

defineExpose({ setCompetitions, setSubmitted })
</script>
