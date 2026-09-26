import { useCallback } from 'react'
import api from './axiosInstance'
import useAuthStore from '../store/useAuthStore'

// Uses the shared axios instance so requests carry the token AND the X-Org-ID header —
// the notification routes are org-scoped (RequireOrg) and reject calls without it.
const useNotifications = () => {
  const setNotifications = useAuthStore((s) => s.setNotifications)
  const markAllNotificationsRead = useAuthStore((s) => s.markAllNotificationsRead)
  const removeNotification = useAuthStore((s) => s.removeNotification)

  const fetchNotifications = useCallback(async () => {
    const { token, activeOrg } = useAuthStore.getState()
    if (!token || !activeOrg?._id) return
    try {
      const res = await api.get('/api/notifications')
      setNotifications(res.data.data || [])
    } catch {
      // silent — bell will just show 0
    }
  }, [setNotifications])

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all', {})
      markAllNotificationsRead()
    } catch {
      // silent
    }
  }, [markAllNotificationsRead])

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`)
      removeNotification(id)
    } catch {
      // silent
    }
  }, [removeNotification])

  return { fetchNotifications, markAllRead, deleteNotification }
}

export default useNotifications
