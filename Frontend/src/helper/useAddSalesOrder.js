import { useState } from 'react'
import api from './axiosInstance'

const useAddSalesOrder = () => {
  // Success/error toasts are handled by the caller (Newsalesorders) so they show once.
  // `loading` guards the submit buttons so a double/triple click can't create duplicates.
  const [loading, setLoading] = useState(false)

  const handleAddSalesOrder = async (salesOrderData) => {
    setLoading(true)
    try {
      const response = await api.post('/api/sales-orders/', salesOrderData)
      return response.data
    } finally {
      setLoading(false)
    }
  }

  return { handleAddSalesOrder, loading }
}

export default useAddSalesOrder
