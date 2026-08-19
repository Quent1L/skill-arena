<template>
  <small v-if="recalculates" class="block mt-1 text-amber-600 dark:text-amber-400">
    <i class="fa fa-triangle-exclamation mr-1" />
    {{ t('fieldEditability.recalculates') }}
  </small>
  <small v-else-if="lockedByMatches" class="block mt-1 text-gray-500">
    <i class="fa fa-lock mr-1" />
    {{ t('fieldEditability.lockedByMatches', { count: matchCount }) }}
  </small>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * The one line under a field that says why it is disabled, or what saving it will
 * cost. A field that is simply locked by the competition's structure gets no note:
 * it can never be edited and there is nothing actionable to say.
 */
defineProps<{
  recalculates?: boolean
  lockedByMatches?: boolean
  matchCount?: number
}>()

const { t } = useI18n()
</script>
