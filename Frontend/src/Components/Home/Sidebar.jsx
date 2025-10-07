import React, { useState } from 'react'


import {FaHome} from 'react-icons/fa'
import { AiOutlineHome } from "react-icons/ai";
import { TbHome } from "react-icons/tb";
import { FaBoxOpen } from "react-icons/fa6";
import { FaCartShopping } from "react-icons/fa6";
import { FaShoppingBag } from "react-icons/fa";
import { MdOutlineShoppingCart } from "react-icons/md";
import { IoMdArrowDropright } from "react-icons/io";
import { IoMdArrowDropdown } from "react-icons/io";
import { HiOutlineShoppingBag } from "react-icons/hi2";
import { TbLogout } from "react-icons/tb";
import { CiCirclePlus } from "react-icons/ci";
const Sidebar = ({sidebarToggle}) => {
    const [home, setHome] = useState(false)
    const [activeItem, setActiveItem] = useState(null);
    const [purchaseItem, setPurchaseItem] = useState(null)
    const [saleItem, setSaleItem] = useState(null);
    const [open, setOpen] = useState(false);
    const [saleOpen, setSaleOpen] = useState(false)
    const [purchaseOpen, setPurchaseOpen] = useState(false)
    const menuItems = [
    "Items",
    "Composite Items",
    "Item Groups",
    "Price Lists",
    "Inventory Adjustments",
  ];
    const saleItems = [
    "Customers",
    "Sales Orders",
    "Packages",
    "Shipments",
    "Delivery Challans",
    "Invoices",
    "Payments Received",
    "Sales Returns",
    "Credit Notes"
  ];

  const purchaseItems = [
    "Vendors",
    "Expenses",
    "Purchase Orders",
    "Purchase Receives",
    "Bills",
    "Payments Made",
    "Vendor Credits"
  ]
  return (
    <div className='w-70 bg-gray-800 fixed h-full px-4 py-2 overflow-y-auto hide-scrollbar'>
        <div className='my-2 mb-4'>
            <h1 className = 'text-2x text-white font-bold cursor-pointer'>ERP</h1>
        </div>
        <hr className='w-70 mt-6 -ml-4'/>
        <ul className={`mt-3 text-white font-bold relative`} >
            <li className={`mb-2 rounded hover:shadow hover:bg-blue-500 py-2 ${home ? "bg-gray-700" : "hover:bg-gray-500"}`} onClick={() => setHome(!home)} >
                <a href="" className = {`px-3 text-md ${home ? "text-blue-400" : "text-white"}`}>
                    <TbHome className='inline-block w-7 h-7 mr-2 -mt-2'></TbHome>
                    Home
                </a>
            </li>
            <ul
        className={`mb-2 rounded hover:shadow  py-2 cursor-pointer ${open ? "bg-gray-700" : "hover:bg-gray-500"}`}
        onClick={() => setOpen(!open)}
      >
        <a className={`px-3 flex items-center text-md ${open ? "text-blue-400" : "text-white"}`}>
          <FaBoxOpen className="inline-block w-7 h-7 mr-2" />
          Inventory
          { open ? <IoMdArrowDropdown className={`inline-block w-4 h-4 ml-auto ${open ? "text-blue-400" : "text-white"}`} /> :  <IoMdArrowDropright className={`inline-block w-4 h-4 ml-auto ${open ? "text-blue-400" : "text-white"}`} /> }
        </a>
      </ul>

      {open &&
      <div className="ml-8 overflow-hidden transition-all duration-300">
      <ul className="space-y-2">
        {menuItems.map((item) => (
          <li key={item}>
            <a
              href="#"
              onClick={() => setActiveItem(item)}
              className={`block px-3 py-1 rounded text-sm transition-colors duration-200
                ${
                  activeItem === item
                    ? "bg-blue-500 text-white" 
                    : "text-white hover:bg-gray-700" 
                }`}
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
      }
      <ul
        className={`mb-2 rounded hover:shadow hover:bg-blue-500 py-2 cursor-pointer ${saleOpen ? "bg-gray-700" : "hover:bg-gray-500"}`}
        onClick={() => setSaleOpen(!saleOpen)}
      >
        <a className={`px-3 flex items-center text-md ${saleOpen ? "text-blue-400" : "text-white"}`}>
          <MdOutlineShoppingCart className="inline-block w-7 h-7 mr-2" />
          Sales
          { saleOpen ? <IoMdArrowDropdown className={`inline-block w-4 h-4 ml-auto  ${saleOpen ? "text-blue-400" : "text-white"}`} /> :  <IoMdArrowDropright className={`inline-block w-4 h-4 ml-auto ${saleOpen ? "text-blue-400" : "text-white"}`} /> }
        </a>
      </ul>
      {saleOpen &&
      <div className="ml-8 overflow-hidden transition-all duration-300">
      <ul className="space-y-2">
        {saleItems.map((item) => (
          <li key={item}>
            <a
              href="#"
              onClick={() => setSaleItem(item)}
              className={`block px-3 py-1 rounded text-sm transition-colors duration-200
                ${
                  saleItem === item
                    ? "bg-blue-500 text-white" 
                    : "text-white hover:bg-gray-700" 
                }`}
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
      }
      <ul
        className="mb-2 rounded hover:shadow hover:bg-blue-500 py-2 cursor-pointer relative"
        onClick={() => setPurchaseOpen(!purchaseOpen)}
      >
        <a className="px-3 flex items-center">
          <HiOutlineShoppingBag className="inline-block w-6 h-6 mr-2" />
          Purchases
          { purchaseOpen ? <IoMdArrowDropdown className={`inline-block w-4 h-4 ml-auto  ${purchaseOpen ? "text-blue-400" : "text-white"}`} /> :  <IoMdArrowDropright className={`inline-block w-4 h-4 ml-auto ${saleOpen ? "text-blue-400" : "text-white"}`} /> }
        </a>
      </ul>
      {purchaseOpen &&
      <div className="ml-8 overflow-hidden transition-all duration-300">
      <ul className="space-y-2">
        {purchaseItems.map((item) => (
          <li key={item}>
            <a
              href="#"
              onClick={() => setPurchaseItem(item)}
              className={`block px-3 py-1 rounded text-sm transition-colors duration-200
                ${
                  activeItem === item
                    ? "bg-blue-500 text-white" 
                    : "text-white hover:bg-gray-700" 
                }`}
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
      }
        </ul>
        <div className="absolute bottom-0 p-4">
          <button className="flex items-center w-full p-2 hover:bg-gray-100 rounded">
          <TbLogout className='inline-block w-7 h-7 mr-2 -mt-2 text-white' />
          </button>
        </div>
    </div>
  )
}

export default Sidebar