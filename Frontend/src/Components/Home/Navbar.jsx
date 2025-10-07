import React, { useState } from 'react'
import { FaBars, FaSearch, FaBell, FaUserCircle } from 'react-icons/fa'
const Navbar = () => {
  const [sidebarToggle, setSidebarToggle] = useState(false);

  return (
    <nav className="bg-gray-800 px-4 py-3 flex justify-between ml-70 w-full">
      
      <div className="flex items-center text-xl">
        {/* <FaBars
          className="text-white me-4 cursor-pointer"
          onClick={() => setSidebarToggle(!sidebarToggle)}
        /> */}
        <span className="text-white font-semibold">ERP</span>
      </div>

      
      <div className="flex items-center gap-x-5">
       
        <div className="relative md:w-84 ">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 cursor-pointer">
            <FaSearch className="text-gray-400 w-4 h-4 " />
          </div>
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 rounded shadow outline-white border border-white md:block color-white text-white"
          />
        </div>

        
        <div className="text-white">
          <FaBell className="w-6 h-6" />
        </div>

        
        <div className="relative">
          <button className="text-white group">
            <FaUserCircle className="w-6 h-6 mt-1" />
            <div className="z-10 hidden absolute bg-white rounded-lg shadow w-32 group-focus:block top-full right-0">
              <ul className="py-2 text-sm text-gray-950">
                <li>
                  <a href="">Profile</a>
                </li>
                <li>
                  <a href="">Setting</a>
                </li>
                <li>
                  <a href="">Log Out</a>
                </li>
              </ul>
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
export default Navbar