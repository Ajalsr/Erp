/**
 * useGetActivityFeed
 * Fetches live activity events from GET /api/dashboard/activity-feed
 *
 * Returns:
 *   activities  — array of ActivityEvent objects
 *   loading     — boolean
 *   error       — string | null
 *   refresh     — call to manually re-fetch
 *
 * Each ActivityEvent:
 *   { id, kind, text, by, createdAt, agoSecs, meta }
 *
 * kind maps directly to the existing actMeta keys in Home.jsx:
 *   "cart"    → new sale order
 *   "invoice" → status change / invoice sent
 *   "truck"   → shipment / outbound
 *   "user"    → new customer
 *   "box"     → low stock alert
 */

import { useState, useEffect, useCallback } from 'react'
import api from './axiosInstance/'

// Format agoSecs into a readable string: "5s", "12m", "3h", "2d"
export function formatAgo(agoSecs) {
  if (agoSecs == null || agoSecs < 0) return '—'
  if (agoSecs < 60)   return `${Math.floor(agoSecs)}s`
  if (agoSecs < 3600) return `${Math.floor(agoSecs / 60)}m`
  if (agoSecs < 86400) return `${Math.floor(agoSecs / 3600)}h`
  return `${Math.floor(agoSecs / 86400)}d`
}

const useGetActivityFeed = (limit = 20, autoRefreshMs = 60000) => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const fetchFeed = useCallback(async () => {
    try {
      setError(null)
      const res = await api.get(`/api/dashboard/activity-feed?limit=${limit}`)
      const data = res.data?.data ?? []
      setActivities(data)
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to load activity feed'
      setError(msg)
      console.error('[useGetActivityFeed]', msg)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchFeed()
    if (autoRefreshMs > 0) {
      const interval = setInterval(fetchFeed, autoRefreshMs)
      return () => clearInterval(interval)
    }
  }, [fetchFeed, autoRefreshMs])

  return { activities, loading, error, refresh: fetchFeed }
}

export default useGetActivityFeed