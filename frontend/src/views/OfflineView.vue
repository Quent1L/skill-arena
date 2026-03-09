<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4"
  >
    <div class="max-w-sm w-full text-center space-y-8">
      <div class="flex justify-center">
        <SkolLogo :width="280" />
      </div>

      <div class="space-y-3">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Vous êtes hors ligne</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Vérifiez votre connexion internet et réessayez.
        </p>
      </div>

      <Button
        :label="checking ? 'Vérification…' : 'Réessayer'"
        :icon="checking ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"
        :disabled="checking"
        @click="probe"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SkolLogo from '@/components/SkolLogo.vue'

const router = useRouter()
const route = useRoute()

const checking = ref(false)

function redirectTarget(): string {
  const r = route.query.redirect
  return typeof r === 'string' && r ? r : '/'
}

async function probe() {
  if (checking.value) return
  if (!navigator.onLine) return
  checking.value = true
  try {
    const res = await fetch('/api/config', { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      router.replace(redirectTarget())
      return
    }
  } catch {
    // still offline
  } finally {
    checking.value = false
  }
}

function onOnline() {
  probe()
}

let interval: ReturnType<typeof setInterval>

onMounted(() => {
  window.addEventListener('online', onOnline)
  interval = setInterval(probe, 15000)
})

onUnmounted(() => {
  window.removeEventListener('online', onOnline)
  clearInterval(interval)
})
</script>
