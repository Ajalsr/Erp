import { useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import useAuthStore from '../store/useAuthStore'

const useGetAllSalesOrder = () => {
  const BASE_URL = "http://localhost:8080"
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const token = useAuthStore((state) => state.token)

  const handleGetSalesorder = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      // Build query string from optional params: { page, limit, status, search, startDate, endDate }
      const query = new URLSearchParams()
      if (params.page)      query.set('page',      params.page)
      if (params.limit)     query.set('limit',     params.limit)
      if (params.status)    query.set('status',    params.status)
      if (params.search)    query.set('search',    params.search)
      if (params.startDate) query.set('startDate', params.startDate)
      if (params.endDate)   query.set('endDate',   params.endDate)

      const url = `${BASE_URL}/api/sales-orders/getsaleorder${query.toString() ? '?' + query.toString() : ''}`

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Response shape: { status, message, data: { total, page, limit, totalPages, salesOrders: [...] } }
      const salesOrderData = response.data?.data ?? null
      setData(salesOrderData)
      return salesOrderData

    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load sales orders."
      setError(msg)
      toast.error(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [token])

  return { handleGetSalesorder, data, loading, error }
}

export default useGetAllSalesOrder