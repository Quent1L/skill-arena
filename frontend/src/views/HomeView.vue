<template>
  <div class="w-full max-w-2xl">
    <div class="text-center space-y-6 p-6">
      <div class="space-y-2">
        <h1 class="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">Skill Arena</h1>
        <p class="text-xl md:text-2xl text-white/90 drop-shadow-md">La chance ne suffira pas</p>
      </div>

      <p class="text-lg text-white/80 max-w-xl mx-auto drop-shadow-md">
        Créez et gérez vos tournois en quelques clics. Championnat ou élimination directe, suivez
        les classements en temps réel.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <Button
          label="Voir les tournois"
          size="large"
          @click="$router.push('/tournaments')"
          class="text-lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>
