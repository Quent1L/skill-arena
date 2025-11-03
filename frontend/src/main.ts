import '@/assets/css/tailwind-related.css'
import '@/assets/css/main.css'
import '@fortawesome/fontawesome-free/css/all.min.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import localeFR from '@/config/locales/fr.json'
import themePreset from './config/PrimevuePreset'
import { useAuth } from './composables/useAuth'

// Initialisation du thème depuis localStorage
const savedTheme = localStorage.getItem('theme') || 'light'
console.log('Theme saved:', savedTheme) // Debug
if (savedTheme === 'dark') {
  document.documentElement.classList.add('my-app-dark')
  console.log('Dark mode applied') // Debug
} else {
  document.documentElement.classList.remove('my-app-dark') // S'assurer que la classe dark est supprimée
  console.log('Light mode applied') // Debug
}

const { checkSession } = useAuth()

await checkSession()
const app = createApp(App)

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
app.use(router)

app.mount('#app')
