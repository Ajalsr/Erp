import { useState, useCallback } from 'react'
import api from './axiosInstance'
import { toast } from 'react-toastify';

// Default: the read-only item picker (/api/stocks/lookup) — open to any role that works on
// a document with item lines, even without Items access. Pass { full: true } on the Items
// pages themselves, which stay gated by the Items → View permission.
const useGetItem = ({ full = false } = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGetItem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(full ? '/api/stocks/getitem' : '/api/stocks/lookup')
      const stocksData = response.data.data
      setData(stocksData)
      return stocksData
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Data item failed..."
      setError(errorMessage)
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [full])

  return { handleGetItem, data, loading, error }
}

export default useGetItem
