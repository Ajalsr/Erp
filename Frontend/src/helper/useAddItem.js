import axios from 'axios'
import useAuthStore from '../store/useAuthStore'

/**
 * useAddItem
 * Pure data hook — NO toast logic here.
 * Resolves with response data on success.
 * Rejects with a plain Error (message = server error string) on failure.
 * The caller (New.jsx) owns all UI feedback.
 */
const useAddItem = () => {
  const BASE_URL = 'http://localhost:8080'
  const store = useAuthStore()

  const handleAdditem = async (inputs) => {
    const response = await axios.post(
      `${BASE_URL}/api/stocks/additem`,
      inputs,
      { headers: { Authorization: `Bearer ${store.token}` } }
    )
    return response.data
  }

  return { handleAdditem }
}

export default useAddItem