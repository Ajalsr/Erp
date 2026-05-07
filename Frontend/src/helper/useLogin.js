import axios from 'axios'
import useAuthStore from '../store/useAuthStore'
import nexusToast from './nexusToast'

const useLogin = () => {
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const { setAuth } = useAuthStore()

  const handleSignin = async (inputs) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/signin`, inputs)
      const { data, token } = response.data

      setAuth(token, data)
      nexusToast.success('Signed in successfully!')

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

  return { handleSignin }
}

export default useLogin