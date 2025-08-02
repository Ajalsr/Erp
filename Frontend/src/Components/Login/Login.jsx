import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const Login = () => {
  const [inputs, setInputs] = useState({
    Id: "",
    pass: ""
  })
  return (
      <div class="flex items-center justify-center min-h-screen bg-gray-100">
      <div
        class="relative flex flex-col m-6 space-y-8 bg-white shadow-2xl rounded-2xl md:flex-row md:space-y-0"
      >
        
        
        
        <div class="relative">
          <img
            src="main.svg"
            alt="img"
            class="w-[400px] h-full hidden rounded-r-2xl md:block "
          />
          
          
        </div>

        <div class="flex flex-col justify-center p-8 md:p-14">
          <span class="mb-3 text-4xl font-bold">Welcome back</span>
          <span class="font-light text-gray-800 mb-8">
            Welcome back! Please enter your details
          </span>
          <div class="py-4">
            <span class="mb-2 text-md">Id</span>
            <input
              type="text"
              class="w-full p-2 border border-gray-300 rounded-md placeholder:font-light placeholder:text-gray-500"
              name="Id"
              value={inputs.Id}
              onChange={(e) => setInputs({...inputs, Id: e.target.value })}
              id="Id"
            />
          </div>
          <div class="py-4">
            <span class="mb-2 text-md">Password</span>
            <input
              type="password"
              name="pass"
              id="pass"
              value={inputs.pass}
              onChange={(e) => setInputs({...inputs, pass: e.target.value})}
              class="w-full p-2 border border-gray-300 rounded-md placeholder:font-light placeholder:text-gray-500"
            />
          </div>
          <div class="flex justify-between w-full py-4">
            <span class="font-bold text-md cursor-pointer">Forgot password</span>
          </div>
          <button
            class="w-full bg-black text-white p-2 rounded-lg mb-6 hover:bg-white hover:text-black hover:border hover:border-gray-300 cursor-pointer"
          >
            Sign in
          </button>
          <div class='ml-4 mt-8'>
            <span>Don't have an account? <Link to="/Signup" class='!text-gray-500 cursor-pointer hover:!text-black'>Sign Up</Link></span>
          </div>
        </div>
      </div>
    </div>
    
  )
}

export default Login