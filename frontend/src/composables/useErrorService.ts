/**
 * Service global de gestion des erreurs non capturées
 */

import type { ToastServiceMethods } from 'primevue/toastservice'

// Singleton pour accéder au ToastService
let toastInstance: ToastServiceMethods | null = null

/**
 * Initialiser le service avec l'instance de Toast
 * À appeler dans App.vue après le montage
 */
export function initErrorService(toast: ToastServiceMethods) {
  toastInstance = toast
  console.log('[Error Service] Toast instance registered')
}

/**
 * Afficher une erreur dans un toast
 */
function showError(error: Error | string, detail?: string) {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorDetail = detail || (typeof error === 'object' && error.stack ? 'Consultez la console pour plus de détails' : undefined)

  console.error('[Global Error Handler]', error)

  // Si le toast n'est pas encore disponible, seulement logger
  if (!toastInstance) {
    console.warn('[Error Service] Toast not available yet, error logged to console only')
    return
  }

  toastInstance.add({
    severity: 'error',
    summary: 'Erreur',
    detail: errorMessage || errorDetail || 'Une erreur inattendue est survenue',
    life: 8000,
  })
}

/**
 * Gestionnaire d'erreurs JavaScript non capturées
 */
function handleError(event: ErrorEvent) {
  event.preventDefault()

  const errorMessage = event.message || 'Erreur JavaScript non capturée'
  const location = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : 'Emplacement inconnu'

  console.error('[Uncaught Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  })

  showError(
    errorMessage,
    `Emplacement: ${location}`
  )
}

/**
 * Gestionnaire de promesses rejetées non capturées
 */
function handleUnhandledRejection(event: PromiseRejectionEvent) {
  event.preventDefault()

  const reason = event.reason
  let errorMessage = 'Promesse rejetée non capturée'
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
}

// Export de la fonction pour les composants Vue
export function useErrorService() {
  return errorService
}
