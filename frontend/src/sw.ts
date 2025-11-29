/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

// Simple service worker for push notifications
// No workbox needed in development mode

self.addEventListener('install', () => {
  console.log('[SW] Service worker installed')
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  console.log('[SW] Service worker activated')
})

self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received:', event)
  if (!event.data) {
    console.log('[SW] No data in push event')
    return
  }
  
  let data: unknown
  try { 
    data = event.data.json()
    console.log('[SW] Push data:', data)
  } catch (err) {
    console.error('[SW] Failed to parse push data:', err)
    return
  }

  const notification = data as { title?: string; message?: string; actionUrl?: string }
  const title = notification.title || 'Notification'
  const options: NotificationOptions = {
    body: notification.message,
    data: { url: notification.actionUrl },
    badge: '/skill-arena-logo.png',
    icon: '/skill-arena-logo.png',
  }
  console.log('[SW] Showing notification:', title, options)
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked:', event.notification)
  event.notification.close()
  const url = event.notification.data?.url
  if (url) {
    console.log('[SW] Opening URL:', url)
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        const client = allClients.find((c: WindowClient) => c.url === url)
        if (client) {
          console.log('[SW] Focusing existing client')
          client.focus()
        } else {
          console.log('[SW] Opening new window')
          await self.clients.openWindow(url)
        }
      })()
    )
  }
})

console.log('[SW] Service worker script loaded')
