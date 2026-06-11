import { useState, useCallback } from 'react'
import api from './axiosInstance'
import nexusToast from './nexusToast'

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
      // The Sales Orders page filters/paginates/counts client-side, so pull the full set
      // by default (backend default is only 10). Callers can still override.
      query.set('limit', params.limit || 5000)
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
      nexusToast.error(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { handleGetSalesorder, data, loading, error }
}

export default useGetAllSalesOrder
