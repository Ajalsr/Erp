import { useState, useCallback } from 'react'
import axios from 'axios'

const useGetCustomers = () => {
  const BASE_URL = "http://localhost:8080"
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGetCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${BASE_URL}/api/customers/getcustomers`)
      console.log("Customers API response:", response.data)
      
      if (response.data && response.data.data) {
        const customersData = response.data.data
        console.log("Customers data:", customersData)
        
        setData(customersData)
        return customersData
      } else {
        console.warn("No customers data received from API")
        setData([])
        return []
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
      setError(error.response?.data?.message || "Failed to fetch customers")
      setData([])
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