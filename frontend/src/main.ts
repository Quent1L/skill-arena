import '@/assets/css/tailwind-related.css'
import '@/assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import '@fontsource/exo-2/900.css'
import '@fontsource/rajdhani/700.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import frLocale from 'primelocale/fr.json'
import enLocale from 'primelocale/en.json'
import themePreset from './config/PrimevuePreset'
import { errorService } from './composables/useErrorService'
import { i18n, getInitialLocale } from './i18n'

if ('serviceWorker' in navigator) {
  let refreshing = false
  const hadController = !!navigator.serviceWorker.controller // false au tout 1er chargement
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return // évite double reload + flicker premier chargement
    refreshing = true
    window.dispatchEvent(new CustomEvent('app:update-available'))
  })

  navigator.serviceWorker.ready.then((registration) => {
    const UPDATE_INTERVAL = 60 * 60 * 1000 // 60 min
    setInterval(() => registration.update(), UPDATE_INTERVAL)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  })
}

window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

window.addEventListener('error', (event) => {
  if (
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Importing a module script failed')
  ) {
    window.location.reload()
  }
})

// Forcer le dark mode
document.documentElement.classList.add('my-app-dark')

// Initialisation du thème depuis localStorage
//const savedTheme = localStorage.getItem('theme') || 'dark'

/**if (savedTheme === 'dark') {
  console.log('Dark mode applied')
} else {
  document.documentElement.classList.remove('my-app-dark')
}**/

// Installer les intercepteurs d'erreurs globaux dès le démarrage
// Les erreurs seront loggées dans la console jusqu'à ce que le Toast soit disponible
errorService.install()

// Appliquer la langue initiale (localStorage) à <html> et à PrimeVue
const initialLocale = getInitialLocale()
document.documentElement.lang = initialLocale
const primevueLocale = initialLocale === 'en' ? enLocale.en : frLocale.fr

// Créer l'application Vue
const app = createApp(App)

// Configurer PrimeVue et les services
app.use(PrimeVue, {
  locale: primevueLocale,
  theme: {
    preset: themePreset,
    options: {
      prefix: 'p',
      darkModeSelector: '.my-app-dark',
      cssLayer: false,
    },
  },
})

app.use(i18n)
app.use(createPinia())
app.use(ToastService)
app.use(ConfirmationService)
app.use(router)

app.mount('#app')
