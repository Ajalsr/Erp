import React from 'react'
import axios from 'axios'
const useSignup = () => {
    
    const BASE_URL = "http://localhost:8080"

    const handleSignup = async (inputs) => {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/signup`, inputs)
            console.log("Signup successful:", response.data)
        } catch (error) {
            console.log("Error during signup:", error)
            throw error
        }

    }

    return {handleSignup}
}

export default useSignup