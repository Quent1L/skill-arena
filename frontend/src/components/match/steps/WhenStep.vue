<template>
  <div class="flex flex-col gap-6 pt-4">
    <h3 class="text-base font-semibold">Date du match</h3>

    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="card in quickCards"
        :key="card.label"
        type="button"
        class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-4 transition-colors cursor-pointer"
        :class="
          selectedQuick === card.key
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-surface-200 dark:border-surface-700 hover:border-primary/50'
        "
        @click="selectQuick(card.key)"
      >
        <i :class="[card.icon, 'text-xl']" />
        <span class="text-sm font-medium">{{ card.label }}</span>
      </button>
    </div>

    <div v-if="selectedQuick === 'custom'" class="flex flex-col gap-2">
      <label class="text-sm font-medium">Date et heure</label>
      <DatePicker
        v-model="customDate"
        show-time
        hour-format="24"
        icon-display="input"
        showIcon
        showButtonBar
        :min-date="minDate ?? undefined"
        :max-date="maxDate ?? undefined"
        manualInput
        @update:model-value="onCustomDate"
      >
        <template #buttonbar="{ clearCallback }">
          <div class="flex justify-between w-full">
            <Button
              size="small"
              severity="secondary"
              label="Maintenant"
              variant="text"
              @click="
                () => {
                  customDate = new Date()
                  onCustomDate(customDate)
                }
              "
            />
            <Button
              size="small"
              severity="secondary"
              label="Effacer"
              variant="text"
              @click="clearCallback"
            />
          </div>
        </template>
      </DatePicker>
    </div>

    <div v-if="!hideNavigation" class="flex justify-end pt-2">
      <Button
        label="Suivant"
        icon="fas fa-arrow-right"
        icon-pos="right"
        :disabled="!playedAtModel"
        @click="emit('next')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'

type QuickKey = 'now' | 'minus5' | 'minus10' | 'custom'

interface Props {
  minDate?: Date | null
  maxDate?: Date | null
  hideNavigation?: boolean
}

interface Emits {
  (e: 'next'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const playedAtModel = defineModel<Date | null>('playedAt', { default: null })

const quickCards = [
  { key: 'now' as QuickKey, label: 'Maintenant', icon: 'fas fa-bolt' },
  { key: 'minus5' as QuickKey, label: 'Il y a 5 min', icon: 'fas fa-clock' },
  { key: 'minus10' as QuickKey, label: 'Il y a 10 min', icon: 'fas fa-history' },
  { key: 'custom' as QuickKey, label: 'Personnaliser', icon: 'fas fa-calendar-alt' },
]

const selectedQuick = ref<QuickKey | null>(null)
const customDate = ref<Date | null>(null)

function dateForKey(key: QuickKey): Date | null {
  if (key === 'now') return new Date()
  if (key === 'minus5') return new Date(Date.now() - 5 * 60 * 1000)
  if (key === 'minus10') return new Date(Date.now() - 10 * 60 * 1000)
  return null
}

function selectQuick(key: QuickKey) {
  selectedQuick.value = key
  if (key !== 'custom') {
    playedAtModel.value = dateForKey(key)
    customDate.value = null
  } else {
    playedAtModel.value = customDate.value
  }
}

function onCustomDate(date: Date | null) {
  playedAtModel.value = date
}

function triggerNext() {
  if (playedAtModel.value) emit('next')
}

defineExpose({ triggerNext })

watch(
  playedAtModel,
  (newVal) => {
    if (newVal && selectedQuick.value === null) {
      selectedQuick.value = 'custom'
      customDate.value = newVal
    }
  },
  { immediate: true },
)
</script>
