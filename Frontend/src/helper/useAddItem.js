import React from 'react'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify';

const useAddItem = () => {
  const BASE_URL = "http://localhost:8080"

    const handleAdditem = async (inputs) => {
        
        try {
            const response = await axios.post(`${BASE_URL}/api/stocks/additem`, inputs)
            console.log("Added Item successful:", response.data)
            toast.success("Item Added successfully!", {
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
            console.log("Error during add item:", error)
            const errorMessage = error.response?.data?.message || "Don't able to add the item.";
      
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

    return {handleAdditem}
}

export default useAddItem