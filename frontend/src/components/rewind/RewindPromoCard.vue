<template>
  <div
    v-if="promoted"
    class="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-700 p-5 text-white shadow-lg"
  >
    <i
      class="fa fa-film pointer-events-none absolute -right-4 -top-4 text-8xl text-white/10"
      aria-hidden="true"
    />

    <div class="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
          {{ t('rewind.promo.eyebrow') }}
        </div>
        <h2 class="truncate text-lg font-black">
          {{ t('rewind.promo.title', { season: promoted.seasonName }) }}
        </h2>
        <p class="text-sm text-indigo-100">
          {{ promoted.disciplineName ? `${promoted.disciplineName} · ` : '' }}
          {{ t('rewind.promo.daysLeft', remainingDays) }}
        </p>
      </div>

      <Button
        :label="t('rewind.promo.action')"
        icon="fa fa-play"
        severity="contrast"
        class="shrink-0"
        @click="open = true"
      />
    </div>

    <RewindLauncher v-model:open="open" :season-id="promoted.seasonId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import { daysUntil, useRewindService } from '@/composables/ranked/rewind.service'
import RewindLauncher from './RewindLauncher.vue'

const { t } = useI18n()
const { promoted, loadPromoted } = useRewindService()

const open = ref(false)

// The window itself is decided server-side; this is only how it is worded.
const remainingDays = computed(() =>
  promoted.value ? daysUntil(new Date(promoted.value.promotedUntil)) : 0,
)

onMounted(loadPromoted)
</script>
