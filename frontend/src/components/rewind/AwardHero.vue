<template>
  <div
    class="relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl px-5 py-6"
    :class="isMine ? 'bg-amber-500/15 ring-1 ring-amber-400/50' : 'bg-white/5'"
  >
    <div v-if="isMine" class="absolute inset-0 animate-pulse bg-amber-400/5" />

    <i :class="icon" class="relative text-4xl" :style="{ color: accent }" />
    <span class="relative text-xs font-semibold uppercase tracking-widest text-gray-400">
      {{ label }}
    </span>
    <span class="relative text-lg font-bold">{{ playerName }}</span>
    <span class="relative text-4xl font-black tabular-nums" :style="{ color: accent }">
      {{ prefix }}{{ counted }}{{ suffix }}
    </span>
    <span v-if="detail" class="relative text-xs text-gray-400">{{ detail }}</span>

    <span
      v-if="isMine"
      class="relative rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300"
    >
      {{ t('rewind.awards.yours') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCountUp } from '@/composables/ui/useCountUp'

const props = withDefaults(
  defineProps<{
    label: string
    playerName: string
    value: number
    icon: string
    accent: string
    detail?: string
    prefix?: string
    suffix?: string
    isMine?: boolean
  }>(),
  { prefix: '', suffix: '', isMine: false },
)

const { t } = useI18n()
const { value: counted } = useCountUp(toRef(props, 'value'))
</script>
