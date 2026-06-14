<template>
  <div class="condition-builder grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
    <ConditionPalette />
    <ConditionGroup v-model="tree" :facts="facts" :players="players" :depth="0" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import ConditionPalette from './ConditionPalette.vue'
import ConditionGroup from './ConditionGroup.vue'
import { fromConditions, toConditions, type BuilderNode, type PlayerOption } from './condition-tree'
import type { RuleConditions } from '@skill-arena/shared/types/index'
import type { CatalogFact } from '@/composables/rules/rules.api'

const props = defineProps<{ modelValue: RuleConditions | null; facts: CatalogFact[]; players: PlayerOption[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: RuleConditions] }>()

type GroupNode = Extract<BuilderNode, { kind: 'group' }>

const tree = ref<GroupNode>(ensureGroup(fromConditions(props.modelValue)))

function ensureGroup(node: BuilderNode): GroupNode {
  return node.kind === 'group' ? node : { kind: 'group', operator: 'all', children: [node] }
}

// Re-hydrate when the parent loads an existing rule.
watch(
  () => props.modelValue,
  (value) => {
    const next = ensureGroup(fromConditions(value))
    if (JSON.stringify(toConditions(next)) !== JSON.stringify(toConditions(tree.value))) {
      tree.value = next
    }
  },
)

// Propagate edits upward in json-rules-engine format.
watch(
  tree,
  (value) => emit('update:modelValue', toConditions(value)),
  { deep: true },
)
</script>
