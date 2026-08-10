<template>
  <Card class="match-message-thread">
    <template #header>
      <div class="flex items-center gap-3">
        <i class="fa fa-comments text-2xl text-primary"></i>
        <h3 class="text-xl font-semibold">{{ t('matchMessageThread.title') }}</h3>
      </div>
    </template>

    <template #content>
      <div class="space-y-4">
        <p class="text-sm text-surface-500 dark:text-surface-400">
          {{ t('matchMessageThread.hint') }}
        </p>

        <div v-if="loading" class="text-sm text-surface-500 dark:text-surface-400">
          {{ t('common.loading') }}
        </div>

        <p
          v-else-if="messages.length === 0"
          class="text-sm text-surface-500 dark:text-surface-400 italic"
        >
          {{ t('matchMessageThread.empty') }}
        </p>

        <ul v-else class="space-y-3">
          <li
            v-for="message in messages"
            :key="message.id"
            :class="[
              'p-3 rounded-lg',
              message.kind === 'system'
                ? 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-sm italic'
                : 'bg-surface-50 dark:bg-surface-800',
            ]"
          >
            <div v-if="message.kind === 'user'" class="flex items-baseline justify-between gap-3">
              <span class="font-semibold">
                {{ message.author?.displayName || t('matchMessageThread.unknownAuthor') }}
              </span>
              <span class="text-xs text-surface-400 dark:text-surface-500">
                {{ formatDate(message.createdAt) }}
              </span>
            </div>

            <!-- Bodies are plain text and interpolated, never injected as HTML -->
            <p class="whitespace-pre-wrap" :class="{ 'mt-1': message.kind === 'user' }">
              {{ renderBody(message) }}
            </p>
          </li>
        </ul>

        <div v-if="canPost" class="space-y-2">
          <Textarea
            id="matchMessageBody"
            v-model="draft"
            rows="3"
            :maxlength="MATCH_MESSAGE_MAX_LENGTH"
            :placeholder="t('matchMessageThread.placeholder')"
            class="w-full"
          />
          <div class="flex items-center justify-between">
            <span class="text-xs text-surface-400 dark:text-surface-500">
              {{ draft.length }} / {{ MATCH_MESSAGE_MAX_LENGTH }}
            </span>
            <Button
              :label="t('matchMessageThread.sendBtn')"
              icon="fa fa-paper-plane"
              :disabled="draft.trim().length === 0 || posting"
              :loading="posting"
              @click="send"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Card from 'primevue/card'
import {
  MATCH_MESSAGE_MAX_LENGTH,
  type ClientMatchMessage,
} from '@skol-arena/shared/types/index'
import { useMatchMessageService } from '@/composables/match/match-message.service'

interface Props {
  matchId: string
  canPost?: boolean
}

const props = defineProps<Props>()

const { t, te, locale } = useI18n()
const { messages, loading, posting, load, post, subscribe } = useMatchMessageService()

const draft = ref('')
let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await load(props.matchId)
  unsubscribe = subscribe(props.matchId)
})

onUnmounted(() => {
  unsubscribe?.()
})

watch(
  () => props.matchId,
  async (matchId) => {
    unsubscribe?.()
    await load(matchId)
    unsubscribe = subscribe(matchId)
  },
)

async function send() {
  const body = draft.value
  await post(props.matchId, body)
  draft.value = ''
}

/**
 * System messages store an i18n key and its params, so they render in the reader's
 * language. User messages are shown verbatim.
 */
function renderBody(message: ClientMatchMessage): string {
  if (message.kind !== 'system') return message.body
  if (!te(message.body)) return message.body
  return t(message.body, message.translationParams ?? {})
}

function formatDate(date: Date | string): string {
  const value = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}
</script>
