import { ref, type Ref } from 'vue'
import { toBlob } from 'html-to-image'

/** Exported at 2× so the card stays crisp when Discord or a phone rescales it. */
const EXPORT_SCALE = 2

export type ShareState = 'idle' | 'working' | 'shared' | 'downloaded' | 'failed'

export function useRewindShare(target: Ref<HTMLElement | null>) {
  const state = ref<ShareState>('idle')

  async function render(): Promise<Blob | null> {
    const node = target.value
    if (!node) return null

    return await toBlob(node, {
      pixelRatio: EXPORT_SCALE,
      // html-to-image inlines resolved computed styles, so the oklab color-mix
      // values used across the app come out as plain rgb. Remote avatars are a
      // different matter: without CORS they are dropped, which is why the card
      // renders initials rather than images.
      cacheBust: true,
      backgroundColor: '#0b0b12',
      filter: (element) => !(element as HTMLElement).dataset?.shareExclude,
    })
  }

  /**
   * Shares the card as a file where the platform supports it, and falls back to
   * a plain download elsewhere — Web Share with files is mobile-only in practice.
   */
  async function share(fileName: string): Promise<void> {
    state.value = 'working'
    try {
      const blob = await render()
      if (!blob) {
        state.value = 'failed'
        return
      }

      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        state.value = 'shared'
        return
      }

      download(blob, fileName)
      state.value = 'downloaded'
    } catch (err) {
      // A user dismissing the share sheet raises AbortError; that is not a failure.
      state.value = (err as Error)?.name === 'AbortError' ? 'idle' : 'failed'
    }
  }

  function download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return { state, share }
}
