import { useState, useRef, useEffect } from "react";

const Navbar = ({ onToggleSidebar }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-white shadow border-b border-gray-200">
      <div className="flex justify-between items-center h-16 w-full px-4">
        <div className="flex items-center">
          {/* Mobile toggle button */}
          <button 
            onClick={onToggleSidebar}
            className="text-gray-500 hover:text-gray-700 md:hidden p-2 rounded-md"
          >
            <i className="fas fa-bars text-lg"></i>
          </button>
          
          {/* Desktop toggle button */}
          <button 
            onClick={onToggleSidebar}
            className="hidden md:flex text-gray-500 hover:text-gray-700 p-2 rounded-md ml-2"
          >
            <i className="fas fa-bars text-lg"></i>
          </button>
          
          <div className="ml-2 md:ml-4">
            <h1 className="text-xl font-semibold text-gray-800">Dashboard Overview</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 relative" ref={dropdownRef}>
          <button className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100">
            <i className="fas fa-bell"></i>
          </button>
          <button className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100">
            <i className="fas fa-envelope"></i>
          </button>
          <div className="ml-2 relative">
  <img 
    src="https://ui-avatars.com/api/?name=John+Doe&background=random" 
    alt="User" 
    className="w-8 h-8 rounded-full cursor-pointer"
    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
  />

  {/* Dropdown menu */}
  {isDropdownOpen && (
    <div className="absolute right-0 top-full mt-2 w-40 bg-white border rounded-md shadow-lg z-50">
      <ul className="py-1">
        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Profile</li>
        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Settings</li>
        <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">Sign Out</li>
      </ul>
    </div>
  )}
</div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
