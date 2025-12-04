import React from 'react'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify';

const useAddCustomer = () => {
  const BASE_URL = "http://localhost:8080"

    const handleAddcustomer = async (inputs) => {
        
        
        try {
            const response = await axios.post(`${BASE_URL}/api/customers/addcustomers`, inputs)
            console.log("Added customer successful:", response.data)
            toast.success("Customer Added successfully!", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
        } catch (error) {
            console.log("Error during add customer:", error)
            const errorMessage = error.response?.data?.message || "Don't able to add the customer.";
      
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
            throw error
        }

    }

    return {handleAddcustomer}
}

export default useAddCustomer