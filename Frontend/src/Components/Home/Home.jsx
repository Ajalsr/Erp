import React from 'react'

import { Link } from 'react-router-dom'

const Home = () => {
  return (
    <>
    <div class="flex min-h-screen justify-center bg-gray-100">
    <div>Home</div>
    <Link to="/" class="ml-80 bg-red">
        <button class="text-white cursor-pointer bg-black w-20 h-10 rounded-lg">Back</button>
      </Link>
    </div>
    </>
  )
}

export default Home