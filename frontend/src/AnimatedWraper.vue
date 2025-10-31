<template>
  <div style="width: 100%; height: 100vh; position: relative">
    <LiquidEther
      :colors="['#4F90FF', '#B8D2FF', '#B8D2FF']"
      :mouseForce="20"
      :cursorSize="100"
      :isViscous="false"
      :viscous="30"
      :iterationsViscous="32"
      :iterationsPoisson="32"
      :resolution="0.5"
      :isBounce="false"
      :autoDemo="true"
      :autoSpeed="0.5"
      :autoIntensity="2.2"
      :takeoverDuration="0.25"
      :autoResumeDelay="3000"
      :autoRampDuration="0.6"
    />

    <div class="absolute inset-0 flex items-center justify-center p-4">
      <RouterView v-slot="{ Component, route }">
        <Transition mode="out-in" appear>
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup lang="ts">
import LiquidEther from '@/components/LiquidEther.vue'
</script>
