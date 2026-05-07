import api from './axiosInstance'
import { toast } from 'react-hot-toast'

const useAddSalesOrder = () => {
  const handleAddSalesOrder = async (salesOrderData) => {
    try {
      const response = await api.post('/api/sales-orders/', salesOrderData)
      toast.success("Sales order created successfully!")
      return response.data
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Unable to create the sales order."
      toast.error(errorMessage)
      throw error
    }
  }
  return { handleAddSalesOrder }
}

export default useAddSalesOrder
