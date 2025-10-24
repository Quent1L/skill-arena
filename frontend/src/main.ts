import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Initialisation du thème depuis localStorage
const savedTheme = localStorage.getItem('theme') || 'light'
console.log('Theme saved:', savedTheme) // Debug
if (savedTheme === 'dark') {
  document.body.classList.add('dark')
  console.log('Dark mode applied') // Debug
} else {
  document.body.classList.remove('dark') // S'assurer que la classe dark est supprimée
  console.log('Light mode applied') // Debug
}

const app = createApp(App)

app.use(router)

app.mount('#app')
