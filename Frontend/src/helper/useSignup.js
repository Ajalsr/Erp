import React from 'react'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify';

const useSignup = () => {
    
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

    const handleSignup = async (inputs) => {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/signup`, inputs)
            console.log("Signup successful:", response.data)
            toast.success("Your account has been created successfully!", {
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
            console.log("Error during signup:", error)
            const errorMessage = error.response?.data?.message || "Signup failed. Please try again.";
      
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

    return {handleSignup}
}

export default useSignup