import axios from 'axios'
import { toast } from 'react-toastify'
import useAuthStore from '../store/useAuthStore'

const useLogin = () => {

  const BASE_URL = "http://localhost:8080"
  const { setAuth } = useAuthStore()

  const handleSignin = async (inputs) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/signin`, inputs)
      const { data, token } = response.data

      
      setAuth(token, data)

      toast.success("Signed in successfully!", {
        position: "top-right",
        autoClose: 3000,
        theme: "light",
      })

      return response.data

    } catch (error) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Sign in failed. Please try again."

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      })

      throw { error: errorMessage }
    }
  }

  return { handleSignin }
}

export default useLogin