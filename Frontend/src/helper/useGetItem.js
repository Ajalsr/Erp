import React, { useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore'

const useGetItem = () => {
  const BASE_URL = "http://localhost:8080"
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const store = useAuthStore()

  const handleGetItem = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${BASE_URL}/api/stocks/getitem`,
        {
          headers: {
            Authorization: `Bearer ${store.token}` // 👈 send token in every request
          }
        }
      )
      console.log("Full API response:", response)
      
      
      const stocksData = response.data.data
      console.log("Stocks data:", stocksData)
      
      setData(stocksData) 
      return stocksData
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
    handleGetItem, 
    data, 
    loading, 
    error 
  }
}

export default useGetItem