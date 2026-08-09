import { http } from '@/api/http/client'
import { apiPaths } from '@/api/http/paths'

export interface CustomerNotification {
  id: number
  orderId: number | null
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function listUnreadNotifications(afterId?: number) {
  const qs = afterId != null ? `?afterId=${afterId}` : ''
  return http.get<CustomerNotification[]>(`${apiPaths.notifications.list}${qs}`)
}

export function getUnreadNotificationCount() {
  return http.get<{ count: number }>(apiPaths.notifications.unreadCount)
}

export function markNotificationRead(id: number) {
  return http.post<void>(apiPaths.notifications.read(String(id)), {})
}

export function markAllNotificationsRead() {
  return http.post<void>(apiPaths.notifications.readAll, {})
}
