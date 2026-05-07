import { useState, useCallback } from 'react'
import api from './axiosInstance'
import { toast } from 'react-hot-toast'

const useGetAllSalesOrder = () => {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleGetSalesorder = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (params.page)      query.set('page',      params.page)
      if (params.limit)     query.set('limit',     params.limit)
      if (params.status)    query.set('status',    params.status)
      if (params.search)    query.set('search',    params.search)
      if (params.startDate) query.set('startDate', params.startDate)
      if (params.endDate)   query.set('endDate',   params.endDate)

      const url = `/api/sales-orders/getsaleorder${query.toString() ? '?' + query.toString() : ''}`
      const response = await api.get(url)

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
  }, [])

  return { handleGetSalesorder, data, loading, error }
}

export default useGetAllSalesOrder
