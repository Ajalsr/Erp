import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/useAuthStore'

// Decode JWT expiry without a library
const getTokenExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, token, clearAuth } = useAuthStore()

  // Check token expiry on every render (catches expiry after tab sits idle)
  const isExpired = token ? (() => {
    const expiry = getTokenExpiry(token)
    return expiry ? Date.now() >= expiry : false
  })() : false

  useEffect(() => {
    if (isAuthenticated && isExpired) {
      toast.error('Your session has expired. Please log in again.', {
        duration: 4000,
        icon: '🔒',
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '500',
        },
      })
      clearAuth()
    }
  }, [isExpired, isAuthenticated, clearAuth])

  if (!isAuthenticated || isExpired) {
    return <Navigate to="/" replace />
  }

  return children ?? <Outlet />
}

export default ProtectedRoute