import React, { useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore'

const useGetAllSalesOrder = () => {
  const BASE_URL = "http://localhost:8080"
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const token = useAuthStore((state) => state.token)

  const handleGetSalesorder = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${BASE_URL}/api/sales-orders/getsaleorder`, {
         headers: {
          Authorization: `Bearer ${token}` // 👈 send token in every request
        }
      })
      console.log("Full API response:", response)
      
      
      const salesOrderData = response.data.data
      console.log("Stocks data:", salesOrderData)
      
      setData(salesOrderData) 
      return salesOrderData
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Data item failed..."
      setError(errorMessage)
      
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return { 
    handleGetSalesorder, 
    data, 
    loading, 
    error 
  }
}

export default useGetAllSalesOrder