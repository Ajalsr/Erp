import React from 'react'
import axios from 'axios'
import { ToastContainer, toast } from 'react-toastify';

const useLogin = () => {
    
    const BASE_URL = "http://localhost:8080"

    const handleSignin = async (inputs) => {
      
        try {
          console.log(inputs,"this is for inputs")
            const response = await axios.post(`${BASE_URL}/api/auth/signin`, inputs)
            console.log(response.data,"this is my resposne")
            localStorage.setItem('userData',JSON.stringify(response.data.data));
            if(response.data === '')
            {
              console.log("Signin Failed:", response)
            toast.error("Sign In Failed!!!..", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
            }
            else {
                console.log("Signin Successfully:", response)
            toast.success("Signed In Successfully!!!..", {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
      });
            }
            
        } catch (error) {
            console.log("Error during signin:", error)
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