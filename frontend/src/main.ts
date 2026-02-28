import '@/assets/css/tailwind-related.css'
import '@/assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import localeFR from '@/config/locales/fr.json'
import themePreset from './config/PrimevuePreset'
import { errorService } from './composables/useErrorService'

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

// Créer l'application Vue
const app = createApp(App)

// Configurer PrimeVue et les services
app.use(PrimeVue, {
  locale: localeFR,
  theme: {
    preset: themePreset,
    options: {
      prefix: 'p',
      darkModeSelector: '.my-app-dark',
      cssLayer: false,
    },
  },
})

app.use(ToastService)
app.use(ConfirmationService)
app.use(router)

app.mount('#app')
