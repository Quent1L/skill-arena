<template>
  <div class="w-full max-w-2xl">
    <div class="text-center space-y-6 p-6">
      <div class="space-y-2">
        <SkolLogo :width="300" class="mx-auto" />
        <p class="text-xl md:text-2xl text-white/90 drop-shadow-md">{{ t('homeView.tagline') }}</p>
      </div>

      <p class="text-lg text-white/80 max-w-xl mx-auto drop-shadow-md">
        {{ t('homeView.description') }}
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <Button
          :label="t('homeView.viewTournaments')"
          size="large"
          @click="$router.push('/tournaments')"
          class="text-lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkolLogo from '@/components/brand/SkolLogo.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
