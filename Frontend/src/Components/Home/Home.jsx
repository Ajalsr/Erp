import React, { useState } from 'react'

import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

const Home = () => {
  const [sidebarToggle, setSidebarToggle] = useState(false)
  return (
    <>
    <div class="flex">
      
    <Sidebar />
    <Navbar
      
    />
    </div>
    
    
    </>
  )
}

export default Home