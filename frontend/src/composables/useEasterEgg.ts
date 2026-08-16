import { readonly, ref } from 'vue'

/**
 * Module-level, like the PWA update state: the trigger lives in the header and
 * the animation is mounted at the app root, and the two never meet in the
 * component tree.
 */
const visible = ref(false)

export function useEasterEgg() {
  return {
    visible: readonly(visible),
    play: (): void => {
      visible.value = true
    },
    stop: (): void => {
      visible.value = false
    },
  }
}
