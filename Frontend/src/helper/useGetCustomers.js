import React, { useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify';

const useGetCustomers = () => {
  const BASE_URL = "http://localhost:8080"
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGetCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${BASE_URL}/api/customers/getcustomers`)
      console.log("Full API response:", response)
      

      if (response.data && response.data.data) {
        localStorage.setItem('counter', response.data.data.length);
        
        const stocksData = response.data.data
        console.log("customers data:", stocksData)
        
        setData(stocksData) 
        return stocksData
      } else {
        
        console.warn("No customers data received from API")
        localStorage.setItem('counter', '0');
        
        setData([]) 
        return []
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Data customers failed..."
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
    handleGetCustomers, 
    data, 
    loading, 
    error 
  }
}

export default useGetCustomers