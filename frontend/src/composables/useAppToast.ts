import { useToast } from 'primevue/usetoast'
import { useViewport } from '@/composables/useViewport'
import type { ToastMessageOptions } from 'primevue/toast'

export function useAppToast() {
  const toast = useToast()
  const { isMobile } = useViewport()

  return {
    ...toast,
    add(message: ToastMessageOptions) {
      if (isMobile.value && message.severity !== 'error') return
      toast.add(message)
    },
  }
}
