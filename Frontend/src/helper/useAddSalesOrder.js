import api from './axiosInstance'
import { toast } from 'react-hot-toast'

const useAddSalesOrder = () => {
  const handleAddSalesOrder = async (salesOrderData) => {
    try {
      const response = await api.post('/api/sales-orders/', salesOrderData)
      toast.success("Sales order created successfully!")
      return response.data
    } catch (error) {
      const data = error.response?.data
      // 422 = credit limit block, 409 = duplicate LPO — caller handles UI inline
      if ((error.response?.status === 422 && data?.creditBlocked) || error.response?.status === 409) {
        throw error
      }
      const errorMessage = data?.message || "Unable to create the sales order."
      toast.error(errorMessage)
      throw error
    }
  }
  return { handleAddSalesOrder }
}

export default useAddSalesOrder
