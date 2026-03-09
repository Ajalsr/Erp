import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/useAuthStore'

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // If children passed (e.g. wrapping Layout), render them
  // Otherwise render nested routes via Outlet
  return children ?? <Outlet />
}

export default ProtectedRoute