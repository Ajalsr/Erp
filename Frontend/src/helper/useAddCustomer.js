import React from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast';

const useAddCustomer = () => {
  const BASE_URL = "http://localhost:8080"

    const handleAddcustomer = async (inputs) => {
        try {
            const response = await axios.post(`${BASE_URL}/api/customers/addcustomers`, inputs)
            console.log("Added customer successful:", response.data)
            toast.success("Customer Added successfully!", {
                duration: 4000, 
            })
            return response.data;
        } catch (error) {
            console.log("Error during add customer:", error)
            const errorMessage = error.response?.data?.message || "Unable to add the customer."
            toast.error(errorMessage)
            throw error
        }
    }

    return {handleAddcustomer}
}

export default useAddCustomer;