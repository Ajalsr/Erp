import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/useAuthStore'

const WS_URL = 'ws://localhost:8080/ws'
const RECONNECT_DELAY_MS = 3000

/**
 * useWebSocket — connects to the backend WebSocket hub and calls
 * the provided `onEvent` callback whenever a broadcast is received.
 *
 * onEvent receives: { type, action, id }
 *   type    → "customers_updated" | "sales_orders_updated" | "stocks_updated"
 *   action  → "create" | "update" | "delete"
 *   id      → affected record id (may be empty)
 *
 * The socket reconnects automatically after disconnects.
 * Pass an empty `onEvent` to skip without disconnecting.
 */
const useWebSocket = (onEvent) => {
  const token = useAuthStore((state) => state.token)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const onEventRef = useRef(onEvent)

  // Keep the callback ref up-to-date without re-connecting
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (onEventRef.current) onEventRef.current(event)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])
}

export default useWebSocket
