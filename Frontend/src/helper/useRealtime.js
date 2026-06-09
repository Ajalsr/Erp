import { useCallback } from 'react'
import useWebSocket from './useWebSocket'
import useAuthStore from '../store/useAuthStore'

/**
 * useRealtime — refetch live when another client mutates relevant data.
 *
 * The backend emits "<entity>_updated" WebSocket events (scoped by orgId) after every
 * successful mutation. Pass the event types this screen cares about and a callback to
 * run when one fires for the active org.
 *
 *   useRealtime(['invoices_updated', 'payments_updated'], loadInvoices)
 *
 * Events for other orgs are ignored, so a user with multiple orgs only reacts to the
 * one they're viewing.
 */
export default function useRealtime(types, onChange) {
  const activeOrg = useAuthStore((s) => s.activeOrg)
  const orgId = activeOrg?._id || ''

  const handler = useCallback((event) => {
    if (!event || !event.type) return
    if (event.orgId && orgId && event.orgId !== orgId) return   // different org — ignore
    if (types && types.length && !types.includes(event.type)) return
    onChange(event)
  }, [orgId, types, onChange])

  useWebSocket(handler)
}
