import axios from 'axios'
import useAuthStore from '../store/useAuthStore'
import nexusToast from './nexusToast'
import { seedPermissions } from './permissions'

// Stable per-browser device id (persists across sessions in localStorage). The
// server trusts a device after its first OTP, so known devices skip OTP.
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem('nx_device_id')
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('nx_device_id', id)
    }
    return id
  } catch {
    return 'dev-fallback'
  }
}

const useLogin = () => {
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const { setAuth } = useAuthStore()

  const finishLogin = (resData) => {
    const { data, token, organizations } = resData
    setAuth(token, data, organizations)
    // Prime the perms cache so the sidebar renders the right menu immediately,
    // before any GET /api/organizations/:id resolves.
    seedPermissions(organizations, data?.userId)
    nexusToast.success('Signed in successfully!')
  }

  const handleSignin = async (inputs) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/signin`, { ...inputs, deviceId: getDeviceId() })
      // New/changed device → server emailed an OTP; don't authenticate yet.
      if (response.data?.otpRequired) return response.data
      finishLogin(response.data)
      return response.data
    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Sign in failed. Please try again.'
      nexusToast.error(errorMessage)
      throw { error: errorMessage }
    }
  }

  const verifyOtp = async (userId, otp) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/verify-otp`, { userId, otp, deviceId: getDeviceId() })
      finishLogin(response.data)
      return response.data
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Verification failed. Please try again.'
      nexusToast.error(errorMessage)
      throw { error: errorMessage }
    }
  }

  return { handleSignin, verifyOtp }
}

export default useLogin