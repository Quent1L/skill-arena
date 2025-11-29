import { useNotificationService } from './notification.service'
import { useAuth } from '../useAuth'
import { convertStringDatesToJS } from '@/utils/DateUtils'

let socket: WebSocket | null = null
let reconnectTimer: number | null = null

const WS_BASE = import.meta.env.DEV
  ? 'ws://localhost:3000'
  : window.location.origin.replace('http', 'ws')

export function useNotificationSocket() {
  const { add } = useNotificationService()
  const { isAuthenticated } = useAuth()

  function connect() {
    if (!isAuthenticated.value) {
      console.log('[WS] Not authenticated, skipping connection')
      return
    }
    
    // Check if already connected or connecting
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        console.log('[WS] Already connected')
        return
      }
      if (socket.readyState === WebSocket.CONNECTING) {
        console.log('[WS] Connection already in progress')
        return
      }
      // If socket exists but is closing/closed, clean it up first
      console.log('[WS] Cleaning up old socket (state:', socket.readyState, ')')
      socket.close()
      socket = null
    }

    console.log('[WS] Connecting to', `${WS_BASE}/api/ws`)
    socket = new WebSocket(`${WS_BASE}/api/ws`)

    socket.onopen = () => {
      console.log('[WS] Connected successfully')
    }

    socket.onmessage = (evt) => {
      console.log('[WS] Message received:', evt.data)
      try {
        const payload = JSON.parse(evt.data)
        if (payload.event === 'new_notification') {
          console.log('[WS] New notification (raw):', payload.data)
          // Convert date strings to Date objects like the HTTP interceptor does
          const notificationWithDates = convertStringDatesToJS(payload.data)
          console.log('[WS] New notification (parsed):', notificationWithDates)
          add(notificationWithDates)
        }
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    socket.onerror = (err) => {
      console.error('[WS] Error:', err)
    }

    socket.onclose = (evt) => {
      console.log('[WS] Closed:', evt.code, evt.reason)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (isAuthenticated.value) {
        console.log('[WS] Reconnecting in 2s...')
        reconnectTimer = window.setTimeout(connect, 2000)
      }
    }
  }

  function disconnect() {
    console.log('[WS] Disconnecting')
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (socket) {
      socket.close()
      socket = null
    }
  }

  return { connect, disconnect }
}
