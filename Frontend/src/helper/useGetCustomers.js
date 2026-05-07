import { useState, useCallback } from 'react'
import api from './axiosInstance'

const useGetCustomers = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGetCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/customers/getcustomers')
      const customersData = response.data?.data ?? []
      setData(customersData)
      return customersData
    } catch (error) {
      setError(error.response?.data?.message || "Failed to fetch customers")
      setData([])
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return { handleGetCustomers, data, loading, error }
}

export default useGetCustomers
