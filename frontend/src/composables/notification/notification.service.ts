import { ref, computed } from 'vue'
import { notificationApi, type RawNotification } from './notification.api'

export type Notification = RawNotification

/**
 * A notification only blocks while what it asks for is still owed. The server re-reads
 * that from the live state on every load, so an action settled elsewhere — a
 * contestation withdrawn, a match arbitrated or deleted — frees the notification.
 */
export function isBlocking(n: Notification): boolean {
  return n.requiresAction && !n.actionResolved && !n.actionCompleted
}

const notifications = ref<Notification[]>([])
const loadingNotifications = ref(false)

function normalize(raw: RawNotification): Notification {
  return { ...raw }
}

export function useNotificationService() {
  async function load() {
    if (loadingNotifications.value) return
    loadingNotifications.value = true
    try {
      const list = await notificationApi.list()
      notifications.value = list.map(normalize)
    } finally {
      loadingNotifications.value = false
    }
  }

  function add(n: RawNotification) {
    notifications.value.unshift(normalize(n))
  }

  async function markRead(id: string) {
    const notif = notifications.value.find((n) => n.id === id)
    if (!notif || notif.isRead) return
    notif.isRead = true
    await notificationApi.markRead(id)
  }

  async function markActionCompleted(id: string) {
    const notif = notifications.value.find((n) => n.id === id)
    if (!notif || notif.actionCompleted) return
    notif.actionCompleted = true
    notif.isRead = true
    await notificationApi.markActionCompleted(id)
  }

  function open(notif: Notification, router?: { push: (url: string) => void }) {
    if (notif.actionUrl && router) {
      router.push(notif.actionUrl)
    }
    if (!isBlocking(notif)) {
      void markRead(notif.id)
    }
  }

  async function deleteNotification(id: string) {
    const notif = notifications.value.find((n) => n.id === id)
    if (!notif) return
    if (isBlocking(notif)) {
      throw new Error('Cannot delete blocking notification')
    }
    // Optimistic update
    notifications.value = notifications.value.filter((n) => n.id !== id)
    try {
      await notificationApi.delete(id)
    } catch (error) {
      // Rollback on error
      notifications.value.push(notif)
      throw error
    }
  }

  async function markAllAsRead() {
    const unreadNotifs = notifications.value.filter((n) => !n.isRead)
    // Optimistic update
    unreadNotifs.forEach((n) => {
      n.isRead = true
    })
    try {
      await Promise.all(unreadNotifs.map((n) => notificationApi.markRead(n.id)))
    } catch (error) {
      // Rollback on error
      unreadNotifs.forEach((n) => {
        n.isRead = false
      })
      throw error
    }
  }

  async function deleteAll() {
    const deletableNotifs = notifications.value.filter((n) => !isBlocking(n))
    if (deletableNotifs.length === 0) return

    // Optimistic update
    const backup = [...notifications.value]
    notifications.value = notifications.value.filter((n) => isBlocking(n))

    try {
      await Promise.all(deletableNotifs.map((n) => notificationApi.delete(n.id)))
    } catch (error) {
      // Rollback on error
      notifications.value = backup
      throw error
    }
  }
  function remove(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }
  const unreadCount = computed(() => notifications.value.filter((n) => !n.isRead).length)

  return {
    notifications,
    unreadCount,
    load,
    add,
    remove,
    markRead,
    markActionCompleted,
    open,
    deleteNotification,
    markAllAsRead,
    deleteAll,
  }
}
