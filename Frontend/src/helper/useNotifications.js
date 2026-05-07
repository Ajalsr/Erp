import { useCallback } from 'react'
import axios from 'axios'
import useAuthStore from '../store/useAuthStore'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const useNotifications = () => {
  const token = useAuthStore((s) => s.token)
  const setNotifications = useAuthStore((s) => s.setNotifications)
  const markAllNotificationsRead = useAuthStore((s) => s.markAllNotificationsRead)
  const removeNotification = useAuthStore((s) => s.removeNotification)

  const headers = () => ({ headers: { Authorization: `Bearer ${token}` } })

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const res = await axios.get(`${BASE_URL}/api/notifications`, headers())
      setNotifications(res.data.data || [])
    } catch {
      // silent — bell will just show 0
    }
  }, [token])

  const markAllRead = useCallback(async () => {
    try {
      await axios.put(`${BASE_URL}/api/notifications/read-all`, {}, headers())
      markAllNotificationsRead()
    } catch {
      // silent
    }
  }, [token])

  const deleteNotification = useCallback(async (id) => {
    try {
      await axios.delete(`${BASE_URL}/api/notifications/${id}`, headers())
      removeNotification(id)
    } catch {
      // silent
    }
  }, [token])

  return { fetchNotifications, markAllRead, deleteNotification }
}

export default useNotifications
