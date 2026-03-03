<template>
  <Transition name="slide-up">
    <div
      v-if="shouldShowBanner"
      class="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 shadow-lg"
      style="background: var(--p-surface-100); border-top: 1px solid var(--p-surface-200)"
    >
      <div class="flex items-center gap-3 min-w-0">
        <img src="@/assets/img/icon-192x192.png" alt="Skol" class="w-10 h-10 rounded-xl shrink-0" />
        <div class="min-w-0">
          <p class="font-semibold text-sm leading-tight">Installer Skol</p>
          <p class="text-xs opacity-60 truncate">Accès rapide depuis l'écran d'accueil</p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <Button
          size="small"
          label="Installer"
          icon="fas fa-download"
          @click="triggerInstall"
        />
        <Button
          size="small"
          icon="fas fa-times"
          text
          severity="secondary"
          aria-label="Fermer"
          @click="handleDismiss"
        />
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div
      v-if="showIOSInstructions"
      class="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 shadow-lg"
      style="background: var(--p-surface-100); border-top: 1px solid var(--p-surface-200)"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm">
          Appuyez sur
          <i class="fas fa-share-from-square mx-1"></i>
          puis <strong>"Sur l'écran d'accueil"</strong>
        </p>
        <Button
          size="small"
          icon="fas fa-times"
          text
          severity="secondary"
          aria-label="Fermer"
          @click="showIOSInstructions = false"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { usePWAInstall } from '@/composables/pwa/pwa.install'

const { shouldShowBanner, showIOSInstructions, triggerInstall, dismissBanner } = usePWAInstall()

function handleDismiss() {
  dismissBanner()
}
</script>
