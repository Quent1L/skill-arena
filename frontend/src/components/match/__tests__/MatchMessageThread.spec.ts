import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick, ref } from 'vue'

import fr from '@/i18n/messages/fr.json'
import { mountWithPrime } from '@/test-support/mount'
import MatchMessageThread from '../MatchMessageThread.vue'
import type { ClientMatchMessage } from '@skol-arena/shared/types/index'

const messages = ref<ClientMatchMessage[]>([])
const post = vi.fn()

vi.mock('@/composables/match/match-message.service', () => ({
  useMatchMessageService: () => ({
    messages,
    loading: ref(false),
    posting: ref(false),
    load: vi.fn(),
    post,
    subscribe: () => () => undefined,
  }),
}))

function makeMessage(over: Partial<ClientMatchMessage> = {}): ClientMatchMessage {
  return {
    id: 'msg-1',
    matchId: 'm-1',
    kind: 'user',
    body: 'le score est faux',
    translationParams: null,
    createdAt: new Date('2026-06-01T15:00:00Z'),
    author: { id: 'p1', displayName: 'Toto' },
    ...over,
  }
}

function mountThread(thread: ClientMatchMessage[], canPost = true) {
  messages.value = thread
  const i18n = createI18n({ legacy: false, locale: 'fr', fallbackLocale: 'fr', messages: { fr } })
  return mountWithPrime(MatchMessageThread, {
    props: { matchId: 'm-1', canPost },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  post.mockReset()
})

describe('MatchMessageThread', () => {
  it('renders a user message with its author', async () => {
    const wrapper = mountThread([makeMessage()])
    await nextTick()

    expect(wrapper.text()).toContain('Toto')
    expect(wrapper.text()).toContain('le score est faux')
  })

  it('renders message bodies as text, never as markup', async () => {
    const wrapper = mountThread([
      makeMessage({ body: '<script>alert(1)</script><img src=x onerror=alert(1)>' }),
    ])
    await nextTick()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
  })

  it('translates a system message from its key and params', async () => {
    const wrapper = mountThread([
      makeMessage({
        id: 'msg-2',
        kind: 'system',
        body: 'matchMessages.RESULT_REVISED',
        translationParams: {
          authorName: 'Toto',
          previousScore: '3 - 1',
          newScore: '2 - 5',
        },
        author: null,
      }),
    ])
    await nextTick()

    expect(wrapper.text()).toContain('Toto a corrigé le résultat : 3 - 1 → 2 - 5')
  })

  it('shows the composer only when the thread accepts new messages', async () => {
    const open = mountThread([], true)
    await nextTick()
    expect(open.find('#matchMessageBody').exists()).toBe(true)

    const closed = mountThread([], false)
    await nextTick()
    expect(closed.find('#matchMessageBody').exists()).toBe(false)
  })

  it('sends the drafted message', async () => {
    const wrapper = mountThread([], true)
    await nextTick()

    await wrapper.find('#matchMessageBody').setValue('score corrigé ?')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(post).toHaveBeenCalledWith('m-1', 'score corrigé ?')
  })
})
