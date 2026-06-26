<template>
  <div class="border rounded p-3" :class="depth % 2 === 0 ? 'border-purple-300 dark:border-purple-700' : 'border-blue-300 dark:border-blue-700'">
    <div class="flex items-center gap-2 mb-3">
      <SelectButton
        v-model="node.operator"
        :options="operatorButtons"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
      <span class="text-xs text-surface-500">
        {{ node.operator === 'all' ? t('conditionGroup.allTrue') : t('conditionGroup.anyTrue') }}
      </span>
      <div class="flex-1"></div>
      <Button :label="t('conditionGroup.addCondition')" icon="fa fa-plus" size="small" text @click="addLeaf" />
      <Button :label="t('conditionGroup.addGroup')" icon="fa fa-plus" size="small" text @click="addGroup" />
      <Button v-if="removable" icon="fa fa-trash" size="small" text rounded severity="danger" @click="$emit('remove')" />
    </div>

    <VueDraggable
      v-model="node.children"
      :group="{ name: 'cond', pull: true, put: true }"
      handle=".fa-grip-vertical, .group-handle"
      class="flex flex-col gap-2 min-h-12 rounded p-1 bg-surface-50 dark:bg-surface-900/40"
    >
      <div v-for="(child, idx) in node.children" :key="idx">
        <ConditionGroup
          v-if="child.kind === 'group'"
          :model-value="child"
          :facts="facts"
          :players="players"
          :depth="depth + 1"
          removable
          @update:model-value="node.children[idx] = $event"
          @remove="removeChild(idx)"
        />
        <ConditionRow
          v-else-if="child.kind === 'leaf'"
          :model-value="child"
          :facts="facts"
          :players="players"
          @update:model-value="node.children[idx] = $event"
          @remove="removeChild(idx)"
        />
      </div>

      <p v-if="node.children.length === 0" class="text-center text-xs text-surface-400 py-3">
        {{ t('conditionGroup.emptyHint') }}
      </p>
    </VueDraggable>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import ConditionRow from './ConditionRow.vue'
import { emptyGroup, emptyLeaf, type BuilderNode, type PlayerOption } from './condition-tree'
import type { CatalogFact } from '@/composables/rules/rules.api'

const { t } = useI18n()

const node = defineModel<Extract<BuilderNode, { kind: 'group' }>>({ required: true })
withDefaults(
  defineProps<{
    facts: CatalogFact[]
    players: PlayerOption[]
    depth?: number
    removable?: boolean
  }>(),
  { depth: 0, removable: false },
)

defineEmits<{ remove: [] }>()

const operatorButtons = computed(() => [
  { label: t('conditionGroup.operatorAnd'), value: 'all' },
  { label: t('conditionGroup.operatorOr'), value: 'any' },
])

function addLeaf() {
  node.value.children.push(emptyLeaf())
}

function addGroup() {
  node.value.children.push(emptyGroup('all'))
}

function removeChild(idx: number) {
  node.value.children.splice(idx, 1)
}
</script>
