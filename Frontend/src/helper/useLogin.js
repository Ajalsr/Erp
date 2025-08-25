import React from 'react'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify';

const useLogin = () => {
    
    const BASE_URL = "http://localhost:8080"

    const handleSignin = async (inputs) => {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/signin`, inputs)
            console.log("Signin successful:", response.data)
            toast.success("Successfully Signed In!!!..", {
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
            const errorMessage = error.response?.data?.message || "Sign in failed. Please try again.";
      
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

    return {handleSignin}
}

export default useLogin