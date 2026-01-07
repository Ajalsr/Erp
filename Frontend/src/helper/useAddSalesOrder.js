import React from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast';

const useAddSalesOrder = () => {
  const BASE_URL = "http://localhost:8080"
  
  const handleAddSalesOrder = async (salesOrderData) => {
    try {
      const response = await axios.post(`${BASE_URL}/api/sales-orders`, salesOrderData)
      console.log("Added sales order successful:", response.data)
      toast.success("Sales order created successfully!", {
        duration: 4000, 
      })
      return response.data;
    } catch (error) {
      console.log("Error during add sales order:", error)
      const errorMessage = error.response?.data?.message || "Unable to create the sales order."
      toast.error(errorMessage)
      throw error
    }
  }

  return { handleAddSalesOrder }
}

export default useAddSalesOrder;