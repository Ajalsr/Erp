import axios from 'axios'
import useAuthStore, { setRememberMe } from '../store/useAuthStore'
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

  // rememberMe: false by default, so a page that forgets to pass it never
  // silently upgrades a session to localStorage.
  const finishLogin = (resData, rememberMe = false) => {
    const { data, token, organizations } = resData
    setRememberMe(rememberMe) // must run before setAuth() writes to storage
    setAuth(token, data, organizations)
    // Prime the perms cache so the sidebar renders the right menu immediately,
    // before any GET /api/organizations/:id resolves.
    seedPermissions(organizations, data?.userId)
    nexusToast.success('Signed in successfully!')
  }

  const handleSignin = async (inputs) => {
    try {
      const { rememberMe, ...creds } = inputs
      const response = await axios.post(`${BASE_URL}/api/auth/signin`, { ...creds, rememberMe: !!rememberMe, deviceId: getDeviceId() })
      // New/changed device → server emailed an OTP; don't authenticate yet.
      if (response.data?.otpRequired) return { ...response.data, rememberMe: !!rememberMe }
      finishLogin(response.data, !!rememberMe)
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

  const verifyOtp = async (userId, otp, rememberMe = false) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/verify-otp`, { userId, otp, rememberMe: !!rememberMe, deviceId: getDeviceId() })
      finishLogin(response.data, !!rememberMe)
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

  const forgotPassword = async (userId) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/forgot-password`, { userId })
      return response.data
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Something went wrong. Please try again.'
      nexusToast.error(errorMessage)
      throw { error: errorMessage }
    }
  }

  const resetPassword = async (userId, otp, newPassword) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/reset-password`, { userId, otp, newPassword })
      return response.data
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Could not reset password. Please try again.'
      nexusToast.error(errorMessage)
      throw { error: errorMessage }
    }
  }

  return { handleSignin, verifyOtp, forgotPassword, resetPassword }
}

export default useLogin