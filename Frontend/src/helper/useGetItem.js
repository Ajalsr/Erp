import { useState, useCallback } from 'react'
import api from './axiosInstance'
import { toast } from 'react-toastify';

const useGetItem = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGetItem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/stocks/getitem')
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
  }, [])

  return { handleGetItem, data, loading, error }
}

export default useGetItem
