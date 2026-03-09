import axios from 'axios'
import useAuthStore from '../store/useAuthStore'

/**
 * axiosInstance - authenticated axios
 * Reads token from Zustand store (which reads from sessionStorage via persist).
 * On 401, clears auth state and redirects to login.
 */
const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token from Zustand on every request
api.interceptors.request.use((config) => {
  // getState() works outside React components
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api