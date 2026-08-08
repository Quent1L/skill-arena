import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { REWIND_HINT_IDLE_MS, useRewindTapHint } from '../useRewindTapHint'

function mountHint(enabled = ref(true), index = ref(0)) {
  let api!: ReturnType<typeof useRewindTapHint>
  const Host = defineComponent({
    setup() {
      api = useRewindTapHint({ enabled, index })
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { api, wrapper, enabled, index }
}

describe('useRewindTapHint', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('waits for the player to stall before offering the hint', () => {
    const { api } = mountHint()

    // Never on arrival: a hint over a card nobody has read yet is noise.
    expect(api.visible.value).toBe(false)

    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS)
    expect(api.visible.value).toBe(true)
  })

  it('restarts the wait on every card change', async () => {
    const { api, wrapper, index } = mountHint()

    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS - 500)
    index.value = 1
    await wrapper.vm.$nextTick()

    vi.advanceTimersByTime(600)
    expect(api.visible.value).toBe(false)

    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS)
    expect(api.visible.value).toBe(true)
  })

  it('treats the gesture as learned after two navigations', () => {
    const { api } = mountHint()

    api.notifyNavigation()
    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS)
    expect(api.visible.value).toBe(true)

    api.notifyNavigation()
    expect(api.visible.value).toBe(false)

    // Not even after a long pause: the player has shown they know.
    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS * 3)
    expect(api.visible.value).toBe(false)
  })

  it('never comes back once learned, in any later deck', () => {
    const first = mountHint()
    first.api.notifyNavigation()
    first.api.notifyNavigation()
    first.wrapper.unmount()

    const { api } = mountHint()
    expect(api.visible.value).toBe(false)
  })

  it('stays out of the way on desktop', () => {
    const { api } = mountHint(ref(false))
    expect(api.visible.value).toBe(false)

    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS)
    expect(api.visible.value).toBe(false)
  })

  it('arms the idle timer when the deck switches to a touch layout', async () => {
    const enabled = ref(false)
    const { api, wrapper } = mountHint(enabled, ref(4))

    enabled.value = true
    await wrapper.vm.$nextTick()
    expect(api.visible.value).toBe(false)

    vi.advanceTimersByTime(REWIND_HINT_IDLE_MS)
    expect(api.visible.value).toBe(true)
  })
})
