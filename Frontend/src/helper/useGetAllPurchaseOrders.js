import { useState, useCallback } from 'react'
import api from './axiosInstance'
import nexusToast from './nexusToast'

const useGetAllPurchaseOrders = () => {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleGetPurchaseOrders = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (params.page)   query.set('page',   params.page)
      if (params.limit)  query.set('limit',  params.limit)
      if (params.status) query.set('status', params.status)
      if (params.q)      query.set('q',      params.q)

      const url = `/api/purchase-orders/getorders${query.toString() ? '?' + query.toString() : ''}`
      const response = await api.get(url)

      const poData = response.data?.data ?? null
      setData(poData)
      return poData
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load purchase orders.'
      setError(msg)
      nexusToast.error(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { handleGetPurchaseOrders, data, loading, error }
}

export default useGetAllPurchaseOrders
