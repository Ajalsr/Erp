import React from "react";
import { Link } from "react-router-dom";

const Signup = () => {
  return (
    <>
     
      
      <div class="flex min-h-screen items-center justify-center bg-gray-100">
      <div class="absolute pt-10 justify-center ">
      <Link to="/" class="ml-80 bg-red">
        <button class="text-white cursor-pointer bg-black w-20 h-10 rounded-lg">Back</button>
      </Link>
        <div class="relative m-6 flex flex-col space-y-8 rounded-2xl bg-white shadow-2xl md:flex-row md:space-y-0">
          

          <div class="flex flex-col justify-center p-8 md:p-14">
            <span class="mb-3 text-4xl font-bold">Welcome</span>
            <span class="mb-8 font-light text-gray-800">
              Welcome! Please enter your details
            </span>
            <div class="py-4">
              <span class="text-md mb-2">Id</span>
              <input
                type="text"
                class="w-full rounded-md border border-gray-300 p-2 placeholder:font-light placeholder:text-gray-500"
                name="Id"
                id="Id"
              />
            </div>
            <div class="py-4">
              <span class="text-md mb-2">Password</span>
              <input
                type="password"
                name="pass"
                id="pass"
                class="w-full rounded-md border border-gray-300 p-2 placeholder:font-light placeholder:text-gray-500"
              />
            </div>
            <button class="mb-6 w-full cursor-pointer rounded-lg bg-black p-2 text-white hover:border hover:border-gray-300 hover:bg-white hover:text-black">
              Sign up
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
