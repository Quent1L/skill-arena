import { ref, onMounted } from 'vue'

// Shared reactive viewport state (singleton)
const width = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
const isMobile = ref(width.value < 768)

function update() {
  if (typeof window === 'undefined') return
  width.value = window.innerWidth
  isMobile.value = window.innerWidth < 768
}

let initialized = false

function init() {
  if (initialized) return
  if (typeof window !== 'undefined') {
    update()
    window.addEventListener('resize', update)
    initialized = true
  }
}

export function useViewport() {
  onMounted(init)
  return { width, isMobile }
}
