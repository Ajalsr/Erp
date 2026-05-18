import axios from 'axios'
import nexusToast from './nexusToast'
import useAuthStore from '../store/useAuthStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
})

// ── Helper: decode JWT payload without a library ─────────────────
const getTokenExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null // convert to ms
  } catch {
    return null
  }
}

// ── Shared logout function (used by both interceptors) ────────────
let logoutToastShown = false // prevent duplicate toasts

const handleExpiredSession = (message = 'Your session has expired. Please log in again.') => {
  if (logoutToastShown) return
  logoutToastShown = true

  nexusToast.error(message)

  // Small delay so the toast renders before navigation
  setTimeout(() => {
    logoutToastShown = false
    useAuthStore.getState().clearAuth()
    window.location.href = '/'
  }, 1500)
}

// ── Request interceptor: attach token + check expiry proactively ──
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    // Check if token is expired before even sending the request
    const expiry = getTokenExpiry(token)
    if (expiry && Date.now() >= expiry) {
      handleExpiredSession()
      // Cancel the request
      const controller = new AbortController()
      controller.abort()
      config.signal = controller.signal
      return config
    }

    config.headers.Authorization = `Bearer ${token}`
  }

  const activeOrg = useAuthStore.getState().activeOrg
  if (activeOrg?._id) {
    config.headers['X-Org-ID'] = activeOrg._id
  }

  return config
})

// ── Response interceptor: handle 401 from server ─────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleExpiredSession()
    }
    return Promise.reject(error)
  }
)

export default api