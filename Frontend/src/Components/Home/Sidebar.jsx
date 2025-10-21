import { useState } from "react";
import { IoHome, IoChevronDown, IoChevronForward } from "react-icons/io5";
import { FaShoppingBag } from "react-icons/fa";
import { FaCartShopping } from "react-icons/fa6";
import { MdInventory } from "react-icons/md";
import { GiShoppingBag } from "react-icons/gi";

const Sidebar = ({ isCollapsed }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [activeItem, setActiveItem] = useState(null); // unified active state

  const menuItems = [
    { icon: <IoHome />, label: "Home" },
    {
      icon: <FaShoppingBag />,
      label: "Items",
      subItems: ["Items", "Composite Items", "Item Groups", "Price Lists"],
    },
    {
      icon: <MdInventory />,
      label: "Inventory",
      subItems: ["Item 1", "Item 2"],
    },
    {
      icon: <FaCartShopping />,
      label: "Sales",
      subItems: ["Customers", "Retainer Invoices", "Sales Orders","Invoices","Delivery Challans","Payments Received","Sales Returns","Credit Notes"],
    },
    {
      icon: <GiShoppingBag />,
      label: "Purchases",
      subItems: ["Vendors", "Purchase Orders","Bills","Purchase Returns","Payments Made","Vendor Credits"],
    },
  ];

  const handleToggle = (item) => {
    if (item.subItems) {
      setOpenMenu((prev) => (prev === item.label ? null : item.label));
    } else {
      setActiveItem(item.label); // make Home active
    }
  };

  const handleSubItemClick = (subItem) => {
    setActiveItem(subItem);
  };

  return (
    <div
      className={`bg-gray-800 text-white flex flex-col h-full fixed md:relative z-10 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && <h2 className="text-xl font-bold">ERP</h2>}
        <div className={isCollapsed ? "mx-auto" : ""}>
          <i className="fas fa-chart-line text-xl"></i>
        </div>
      </div>

      {/* Sidebar Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const hasSubmenu = !!item.subItems;
            const isOpen = openMenu === item.label;
            const isActive = activeItem === item.label;

            return (
              <li key={index} >
                {/* Main Menu */}
                <button
                  onClick={() => handleToggle(item)}
                  className={`w-full flex items-center p-2 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {/* Chevron placeholder */}
                  <span
                    className={`flex items-center justify-center w-6 ${
                      isCollapsed ? "mx-auto" : "mr-2"
                    }`}
                  >
                    {hasSubmenu ? (
                      isOpen ? (
                        <IoChevronDown className="text-sm" />
                      ) : (
                        <IoChevronForward className="text-sm" />
                      )
                    ) : (
                      <span className="w-3" />
                    )}
                  </span>

                  {/* Icon */}
                  <span className="flex items-center justify-center w-6 mr-3">
                    {item.icon}
                  </span>

                  {/* Label */}
                  {!isCollapsed && <span>{item.label}</span>}
                </button>

                {/* Submenu */}
                {!isCollapsed && hasSubmenu && (
                  <div
  className={`ml-8 overflow-hidden transition-all duration-500 ease-in-out ${
    isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
  }`}
>
                    <ul className="mt-2 space-y-1 text-sm text-gray-300">
                      {item.subItems.map((subItem, subIndex) => (
                        <li
                          key={subIndex}
                          onClick={() => handleSubItemClick(subItem)}
                          className={`cursor-pointer ml-9 p-2 rounded-lg transition-colors duration-200 ${
                            activeItem === subItem
                              ? "bg-blue-500 text-white"
                              : "hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          {subItem}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
