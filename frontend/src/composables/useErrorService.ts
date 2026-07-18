/**
 * Service global de gestion des erreurs non capturées
 */

import type { ToastServiceMethods } from 'primevue/toastservice'
import { isNetworkError } from '@/utils/HttpErrors'
import { i18n } from '@/i18n'

// Singleton pour accéder au ToastService
let toastInstance: ToastServiceMethods | null = null

const TOAST_LIFE_MS = 8000

/**
 * An unreachable backend fails several calls in a row (config, session, retry...).
 * This lock prevents stacking one toast per call: a single message, for as long as
 * the toast stays visible.
 */
let networkToastVisible = false

/**
 * Initialiser le service avec l'instance de Toast
 * À appeler dans App.vue après le montage
 */
export function initErrorService(toast: ToastServiceMethods) {
  toastInstance = toast
  console.log('[Error Service] Toast instance registered')
}

/**
 * Unreachable server: an explicit message rather than raw browser text
 * ("NetworkError when attempting to fetch resource"), and one toast at a time.
 * This is not an application bug — hence the `warn` severity.
 */
function showNetworkError() {
  if (networkToastVisible || !toastInstance) {
    return
  }

  networkToastVisible = true
  setTimeout(() => {
    networkToastVisible = false
  }, TOAST_LIFE_MS)

  toastInstance.add({
    severity: 'warn',
    summary: i18n.global.t('errorService.serverUnreachableSummary'),
    detail: i18n.global.t('errorService.serverUnreachableDetail'),
    life: TOAST_LIFE_MS,
  })
}

/**
 * Afficher une erreur dans un toast
 */
function showError(error: Error | string, detail?: string) {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorDetail = detail || (typeof error === 'object' && error.stack ? i18n.global.t('errorService.checkConsole') : undefined)

  console.error('[Global Error Handler]', error)

  // Network failure: dedicated message, never the browser's technical text.
  if (isNetworkError(error)) {
    showNetworkError()
    return
  }

  // Si le toast n'est pas encore disponible, seulement logger
  if (!toastInstance) {
    console.warn('[Error Service] Toast not available yet, error logged to console only')
    return
  }

  toastInstance.add({
    severity: 'error',
    summary: i18n.global.t('errorService.summary'),
    detail: errorMessage || errorDetail || i18n.global.t('errorService.unexpectedError'),
    life: TOAST_LIFE_MS,
  })
}

/**
 * Gestionnaire d'erreurs JavaScript non capturées
 */
function handleError(event: ErrorEvent) {
  event.preventDefault()

  const errorMessage = event.message || i18n.global.t('errorService.uncaughtJs')
  const location = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : i18n.global.t('errorService.unknownLocation')

  console.error('[Uncaught Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  })

  showError(
    errorMessage,
    i18n.global.t('errorService.locationPrefix', { location })
  )
}

/**
 * Gestionnaire de promesses rejetées non capturées
 */
function handleUnhandledRejection(event: PromiseRejectionEvent) {
  event.preventDefault()

  const reason = event.reason
  let errorMessage = i18n.global.t('errorService.unhandledRejection')
  let errorDetail: string | undefined

  if (reason instanceof Error) {
    errorMessage = reason.message
    errorDetail = reason.name
  } else if (typeof reason === 'string') {
    errorMessage = reason
  } else if (reason && typeof reason === 'object') {
    // Gérer les erreurs API (format { error: { code, message } })
    if (reason.error?.message) {
      errorMessage = reason.error.message
      errorDetail = reason.error.code
    } else if (reason.message) {
      errorMessage = reason.message
    } else {
      errorMessage = JSON.stringify(reason)
    }
  }

  console.error('[Unhandled Promise Rejection]', {
    reason,
    promise: event.promise,
  })

  showError(errorMessage, errorDetail)
}

/**
 * Installer les intercepteurs d'erreurs globaux
 */
function install() {
  // Intercepter les erreurs JavaScript non capturées
  window.addEventListener('error', handleError)

  // Intercepter les promesses rejetées non capturées
  window.addEventListener('unhandledrejection', handleUnhandledRejection)

  console.log('[Error Service] Global error handlers installed')
}

/**
 * Désinstaller les intercepteurs d'erreurs globaux
 */
function uninstall() {
  window.removeEventListener('error', handleError)
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)

  console.log('[Error Service] Global error handlers uninstalled')
}

// Export du service sous forme d'objet
export const errorService = {
  install,
  uninstall,
  showError,
  showNetworkError,
}

// Export de la fonction pour les composants Vue
export function useErrorService() {
  return errorService
}
