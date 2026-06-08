import api from './axiosInstance'

const useAddSalesOrder = () => {
  // Success/error toasts are handled by the caller (Newsalesorders) so they show once.
  const handleAddSalesOrder = async (salesOrderData) => {
    const response = await api.post('/api/sales-orders/', salesOrderData)
    return response.data
  }
  return { handleAddSalesOrder }
}

export default useAddSalesOrder
