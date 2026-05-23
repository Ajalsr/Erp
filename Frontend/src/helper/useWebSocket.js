import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/useAuthStore'

// Derive WebSocket URL from API URL: http→ws, https→wss
const _api = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const WS_URL = _api.replace(/^http/, 'ws') + '/ws'
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

    const ws = new WebSocket(token ? `${WS_URL}?token=${token}` : WS_URL)
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
      const ws = wsRef.current
      wsRef.current = null
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) return
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      if (ws.readyState === WebSocket.CONNECTING) {
        // close as soon as it connects — avoids "closed before established" error
        ws.onopen = () => ws.close()
      } else {
        ws.close()
      }
    }
  }, [connect])
}

export default useWebSocket
