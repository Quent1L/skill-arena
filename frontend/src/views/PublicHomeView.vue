<template>
  <div class="w-full flex items-center justify-center">
    <div class="text-center space-y-6 p-6">
      <SkolLogo class="mx-auto h-80"></SkolLogo>

      <p class="text-xl md:text-2xl text-white/90 drop-shadow-md">La chance ne suffira pas</p>

      <p class="text-lg text-white/80 max-w-xl mx-auto drop-shadow-md">
        Créez et gérez vos tournois en quelques clics. Championnat ou élimination directe, suivez
        les classements et vos statistiques.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <Button
          label="Accéder à l'application"
          size="large"
          @click="$router.push('/')"
          class="text-lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkolLogo from '@/components/SkolLogo.vue'
</script>
